import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildStage1SystemPrompt } from "../../../../lib/wedding-prompts.js";
import { CONFIRM_WEDDING_BUDGET_TOOL, PROPOSE_PLANS_TOOL, WEB_SEARCH_TOOL } from "../../../../lib/wedding-tools.js";
import { confirmWeddingBudgetSchema, proposePlansSchema } from "../../../../lib/wedding-validation.js";
import { buildMockPlanOptions, buildMockWeddingConfirmation, looksLikeConfirmation } from "../../../../lib/wedding-mock.js";
import {
  appendMessages,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/wedding-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";
import { findActGrantor } from "../../../../lib/access-grant-store.js";
import { proposeJointAction } from "../../../../lib/joint-action-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine", "edit_activities"]);

// Falls back to a local template response only when the real Anthropic call itself fails (e.g. no
// API credits) - never used just because the model said something unexpected. Once a real
// ANTHROPIC_API_KEY with credit is configured, this path is simply never reached. Venue/
// photography/attire still come out real either way - see lib/wedding-validation.js's
// attachWeddingFinancials, which runs on mock output exactly the same as real output.
async function buildMockToolUse(message, sessionId) {
  const previousPlanOptions = await getLatestArtifact(sessionId, "stage1", "plan_options");
  if (looksLikeConfirmation(message) && previousPlanOptions) {
    return { name: "confirm_wedding_budget", input: buildMockWeddingConfirmation(message, previousPlanOptions) };
  }
  return { name: "propose_plans", input: buildMockPlanOptions() };
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { intent, message, language } = body;

  if (!VALID_INTENTS.has(intent)) {
    return Response.json({ error: "invalid_intent" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }

  const session = await getOrCreateSession(userId);
  const history = await getMessageHistory(session.id, "stage1");
  const userContent = buildFollowUpUserContent(history, message);
  const messages = [...history, { role: "user", content: userContent }];

  const client = getAnthropicClient();
  let toolUse;
  let assistantContent;
  let mocked = false;
  try {
    const response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      // "low", not "medium" - a real live call confirmed this route (real
      // web_search + thinking + 12000 max_tokens) can exceed Vercel's 60s
      // function timeout at "medium" effort. Matches home/retirement/
      // investment/loan's stage1 routes, which were already at "low".
      output_config: { effort: "low" },
      system: buildStage1SystemPrompt(language),
      tools: [WEB_SEARCH_TOOL, PROPOSE_PLANS_TOOL, CONFIRM_WEDDING_BUDGET_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    toolUse = findToolUse(response.content, ["propose_plans", "confirm_wedding_budget"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    assistantContent = response.content;
  } catch (error) {
    console.error("wedding/stage1 Anthropic call failed, falling back to mock response", error);
    toolUse = await buildMockToolUse(message, session.id);
    mocked = true;
    assistantContent = [{ type: "tool_use", id: `mock-${Date.now()}`, name: toolUse.name, input: toolUse.input }];
  }

  const schema = toolUse.name === "propose_plans" ? proposePlansSchema : confirmWeddingBudgetSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("wedding/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);

  // Joint (couple) confirmation: if a partner has granted this user
  // "view_and_act" on the wedding domain, the budget isn't saved directly -
  // it's proposed as a joint action and only actually written once that
  // partner separately confirms (lib/goal-plan-actions.js's
  // applyGoalPlanJointConfirm, dispatched via app/api/joint-actions/[id]/
  // confirm). No grant -> unchanged direct-save behavior below.
  if (toolUse.name === "confirm_wedding_budget") {
    const grantor = await findActGrantor(userId, "wedding");
    if (grantor) {
      try {
        const action = await proposeJointAction({
          initiatorUserId: userId,
          targetUserId: grantor.grantor_user_id,
          domain: "wedding",
          actionType: "confirm_wedding_plan",
          payload: { kind: "budget", ...parsed.data },
        });
        return Response.json({
          type: toolUse.name,
          status: "pending_partner_confirmation",
          jointActionId: action.id,
          data: parsed.data,
          mocked,
        });
      } catch (error) {
        // Grant was revoked in the moment between findActGrantor and here -
        // fall through to the direct-save path below rather than 500ing.
        if (error.code !== "no_joint_grant") throw error;
      }
    }
  }

  const artifactType = toolUse.name === "propose_plans" ? "plan_options" : "confirmed_budget";
  const createdAt = await saveArtifact(session.id, "stage1", artifactType, parsed.data);

  if (toolUse.name === "confirm_wedding_budget") {
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
  }

  return Response.json({
    type: toolUse.name,
    data: parsed.data,
    confirmedAt: toolUse.name === "confirm_wedding_budget" ? createdAt : undefined,
    mocked,
  });
}
