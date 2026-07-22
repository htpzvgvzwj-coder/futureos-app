import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildHomeStage2SystemPrompt } from "../../../../lib/home-prompts.js";
import { FINALIZE_HOME_SAVINGS_PLAN_TOOL, PROPOSE_HOME_SAVINGS_PLAN_TOOL } from "../../../../lib/home-tools.js";
import { finalizeHomeSavingsPlanSchema, proposeHomeSavingsPlanSchema } from "../../../../lib/home-validation.js";
import { buildMockSavingsFinalization, buildMockSavingsPlanOptions, looksLikeConfirmation } from "../../../../lib/home-mock.js";
import {
  appendMessages,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/home-store.js";
import { getLatestArtifact as getLatestLoanArtifact, getOrCreateSession as getOrCreateLoanSession } from "../../../../lib/loan-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

async function buildMockToolUse(message, sessionId, financedPlan, profile) {
  const previousStrategyOptions = await getLatestArtifact(sessionId, "stage2", "savings_plan_options");
  if (looksLikeConfirmation(message) && previousStrategyOptions) {
    return {
      name: "finalize_home_savings_plan",
      input: buildMockSavingsFinalization(message, previousStrategyOptions, financedPlan),
    };
  }
  return { name: "propose_home_savings_plan", input: buildMockSavingsPlanOptions(financedPlan, profile) };
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

  const session = await getOrCreateSession(userId);
  const confirmedPlan = await getLatestArtifact(session.id, "stage1", "confirmed_plan");
  if (!confirmedPlan) {
    return Response.json({ error: "no_confirmed_plan" }, { status: 409 });
  }

  const loanSession = await getOrCreateLoanSession(userId, "home");
  const confirmedLoan = await getLatestLoanArtifact(loanSession.id, "stage1", "confirmed_loan");
  if (!confirmedLoan) {
    return Response.json({ error: "no_confirmed_loan" }, { status: 409 });
  }
  const financedPlan = {
    ...confirmedPlan,
    down_payment_cash_cpf: confirmedLoan.down_payment_cash_cpf,
    min_cash_component: confirmedLoan.min_cash_component,
    loan_amount: confirmedLoan.loan_amount,
  };

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
      system: buildHomeStage2SystemPrompt(language, profile, financedPlan),
      tools: [PROPOSE_HOME_SAVINGS_PLAN_TOOL, FINALIZE_HOME_SAVINGS_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    toolUse = findToolUse(response.content, ["propose_home_savings_plan", "finalize_home_savings_plan"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    assistantContent = response.content;
  } catch (error) {
    console.error("home/stage2 Anthropic call failed, falling back to mock response", error);
    toolUse = await buildMockToolUse(message, session.id, financedPlan, profile);
    mocked = true;
    assistantContent = [{ type: "tool_use", id: `mock-${Date.now()}`, name: toolUse.name, input: toolUse.input }];
  }

  const schema = toolUse.name === "propose_home_savings_plan" ? proposeHomeSavingsPlanSchema : finalizeHomeSavingsPlanSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("home/stage2 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage2", [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);

  const artifactType = toolUse.name === "propose_home_savings_plan" ? "savings_plan_options" : "confirmed_savings_plan";
  await saveArtifact(session.id, "stage2", artifactType, parsed.data);

  if (toolUse.name === "finalize_home_savings_plan") {
    await updateSessionStatus(session.id, { stage2Status: "confirmed" });
  } else {
    await updateSessionStatus(session.id, { stage2Status: "in_progress" });
  }

  return Response.json({ type: toolUse.name, data: parsed.data, mocked });
}
