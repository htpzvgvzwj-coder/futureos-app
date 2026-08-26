import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildStage2SystemPrompt } from "../../../../lib/wedding-prompts.js";
import { FINALIZE_SAVINGS_PLAN_TOOL, PROPOSE_SAVINGS_PLAN_TOOL } from "../../../../lib/wedding-tools.js";
import { finalizeSavingsPlanSchema, proposeSavingsPlanSchema } from "../../../../lib/wedding-validation.js";
import { buildMockSavingsFinalization, buildMockSavingsPlanOptions, looksLikeConfirmation } from "../../../../lib/wedding-mock.js";
import {
  appendMessages,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/wedding-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";
import { resolveAssetPromptContext } from "../../../../lib/liquid-savings-context.js";
import { computeMilestoneFeasibility } from "../../../../lib/wedding-finance.js";
import { findActGrantor } from "../../../../lib/access-grant-store.js";
import { proposeJointAction } from "../../../../lib/joint-action-store.js";
import { triggerCrossGoalCheck } from "../../../../lib/guardian-alert-store.js";
import { computeJointPlanEvidence } from "../../../../lib/joint-plan-evidence.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

async function buildMockToolUse(message, sessionId, confirmedBudget, profile) {
  const previousStrategyOptions = await getLatestArtifact(sessionId, "stage2", "savings_plan_options");
  if (looksLikeConfirmation(message) && previousStrategyOptions) {
    return {
      name: "finalize_savings_plan",
      input: buildMockSavingsFinalization(message, previousStrategyOptions, confirmedBudget),
    };
  }
  return { name: "propose_savings_plan", input: buildMockSavingsPlanOptions(confirmedBudget, profile) };
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { intent, message, language, profile } = body;

  if (!VALID_INTENTS.has(intent)) {
    return Response.json({ error: "invalid_intent" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }
  if (!profile || typeof profile.monthlyIncome === "undefined") {
    return Response.json({ error: "missing_profile" }, { status: 400 });
  }
  // Server-truth available liquid savings instead of the raw client-sent
  // figure - already nets out any confirmed lump-sum investment draw. See
  // lib/liquid-savings-context.js.
  // "tight" horizon - a wedding is typically months away, close enough
  // that forcing a sale of a market-exposed "liquid" holding right before
  // the money is needed would be a bad idea. See lib/asset-finance.js's
  // computeAvailableSavings.
  const assetContext = await resolveAssetPromptContext(userId, profile.currentSavings, profile.monthlyExpenses, "tight");
  const availableSavingsNow = assetContext.availableLiquidSavings;
  const resolvedProfile = {
    ...profile,
    currentSavings: String(availableSavingsNow),
    emergencyBufferMonths: assetContext.emergencyBufferMonths,
    hasActiveInsurance: assetContext.hasActiveInsurance,
  };

  const session = await getOrCreateSession(userId);
  const confirmedBudget = await getLatestArtifact(session.id, "stage1", "confirmed_budget");
  if (!confirmedBudget) {
    return Response.json({ error: "no_confirmed_budget" }, { status: 409 });
  }

  const history = await getMessageHistory(session.id, "stage2");
  const userContent = buildFollowUpUserContent(history, message);
  const messages = [...history, { role: "user", content: userContent }];

  const client = getAnthropicClient();
  let toolUse;
  let assistantContent;
  let mocked = false;
  try {
    const response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: buildStage2SystemPrompt(language, resolvedProfile, confirmedBudget),
      tools: [PROPOSE_SAVINGS_PLAN_TOOL, FINALIZE_SAVINGS_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    toolUse = findToolUse(response.content, ["propose_savings_plan", "finalize_savings_plan"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    assistantContent = response.content;
  } catch (error) {
    console.error("wedding/stage2 Anthropic call failed, falling back to mock response", error);
    toolUse = await buildMockToolUse(message, session.id, confirmedBudget, resolvedProfile);
    mocked = true;
    assistantContent = [{ type: "tool_use", id: `mock-${Date.now()}`, name: toolUse.name, input: toolUse.input }];
  }

  const schema = toolUse.name === "propose_savings_plan" ? proposeSavingsPlanSchema : finalizeSavingsPlanSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("wedding/stage2 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage2", [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);

  // Real gap this closes: the model only ever sees ONE final target date,
  // so a backloaded plan can look fully funded overall while still failing
  // to cover a deposit due next month. Checked deterministically against
  // the real payment_schedule (lib/wedding-finance.js), never left to the
  // model to reason about.
  const finalData =
    toolUse.name === "finalize_savings_plan" && Array.isArray(confirmedBudget.payment_schedule)
      ? {
          ...parsed.data,
          milestone_feasibility: computeMilestoneFeasibility(confirmedBudget.payment_schedule, {
            monthlyContribution: parsed.data.monthly_contribution,
            startMonth: parsed.data.start_month,
            availableSavingsNow,
          }),
        }
      : parsed.data;

  // Joint (couple) confirmation: same gate as stage1's confirm_wedding_budget
  // - if a partner has granted this user "view_and_act" on the wedding
  // domain, the finalized savings plan isn't saved directly, it's proposed
  // as a joint action. No grant -> unchanged direct-save behavior below.
  if (toolUse.name === "finalize_savings_plan") {
    const grantor = await findActGrantor(userId, "wedding");
    if (grantor) {
      try {
        // Real evidence for the confirming partner (app/grants/page.jsx) -
        // the same feasibility/whole-picture numbers the initiator saw,
        // not a blind Confirm/Decline on a one-line summary. See
        // lib/joint-plan-evidence.js.
        const jointEvidence = await computeJointPlanEvidence(userId, {
          monthlyIncome: profile.monthlyIncome,
          monthlyExpenses: profile.monthlyExpenses,
          availableLiquidSavings: availableSavingsNow,
          monthlyContribution: finalData.monthly_contribution,
        });
        const action = await proposeJointAction({
          initiatorUserId: userId,
          targetUserId: grantor.grantor_user_id,
          domain: "wedding",
          actionType: "confirm_wedding_plan",
          payload: {
            kind: "savings_plan",
            ...finalData,
            jointEvidence,
            // Carried through so the joint dispatcher can run the same
            // triggerCrossGoalCheck the direct-save path below runs - the
            // partner's later confirm has no request body of its own to
            // read these from. See lib/goal-plan-actions.js.
            crossGoalCheckInputs: {
              monthlyIncome: profile.monthlyIncome,
              monthlyExpenses: profile.monthlyExpenses,
              currentSavings: availableSavingsNow,
            },
          },
        });
        return Response.json({
          type: toolUse.name,
          status: "pending_partner_confirmation",
          jointActionId: action.id,
          data: finalData,
          mocked,
        });
      } catch (error) {
        if (error.code !== "no_joint_grant") throw error;
      }
    }
  }

  const artifactType = toolUse.name === "propose_savings_plan" ? "savings_plan_options" : "confirmed_savings_plan";
  await saveArtifact(session.id, "stage2", artifactType, finalData);

  if (toolUse.name === "finalize_savings_plan") {
    await updateSessionStatus(session.id, { stage2Status: "confirmed" });
    // Real proactive check: does this new commitment push the customer's
    // real total committed outflow (or an already-confirmed loan's real
    // Future Score) past a risk threshold? See lib/cross-goal-context.js /
    // lib/guardian-alert-store.js. Never fails the confirm itself.
    await triggerCrossGoalCheck(userId, "wedding", {
      monthlyIncome: profile.monthlyIncome,
      monthlyExpenses: profile.monthlyExpenses,
      currentSavings: availableSavingsNow,
    });
  } else {
    await updateSessionStatus(session.id, { stage2Status: "in_progress" });
  }

  return Response.json({ type: toolUse.name, data: finalData, mocked });
}
