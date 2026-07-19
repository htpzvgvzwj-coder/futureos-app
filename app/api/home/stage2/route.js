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
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/home-store.js";
import { DEFAULT_PROFILE_KEY as LOAN_DEFAULT_PROFILE_KEY, getLatestArtifact as getLatestLoanArtifact, getOrCreateSession as getOrCreateLoanSession } from "../../../../lib/loan-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

export async function POST(request) {
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

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
  const confirmedPlan = await getLatestArtifact(session.id, "stage1", "confirmed_plan");
  if (!confirmedPlan) {
    return Response.json({ error: "no_confirmed_plan" }, { status: 409 });
  }

  // The actual financing numbers (down payment/loan amount) are now decided
  // in the Loan Planner, not by Home Purchase Planner's own baseline
  // LTV-max computation — the savings plan must target what the customer
  // actually chose there, not a default nobody picked.
  const loanSession = await getOrCreateLoanSession(LOAN_DEFAULT_PROFILE_KEY, "home");
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
  let response;
  try {
    response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: buildHomeStage2SystemPrompt(language, profile, financedPlan),
      tools: [PROPOSE_HOME_SAVINGS_PLAN_TOOL, FINALIZE_HOME_SAVINGS_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
  } catch (error) {
    console.error("home/stage2 Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["propose_home_savings_plan", "finalize_home_savings_plan"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const schema = toolUse.name === "propose_home_savings_plan" ? proposeHomeSavingsPlanSchema : finalizeHomeSavingsPlanSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("home/stage2 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage2", [
    { role: "user", content: userContent },
    { role: "assistant", content: response.content },
  ]);

  const artifactType = toolUse.name === "propose_home_savings_plan" ? "savings_plan_options" : "confirmed_savings_plan";
  await saveArtifact(session.id, "stage2", artifactType, parsed.data);

  if (toolUse.name === "finalize_home_savings_plan") {
    await updateSessionStatus(session.id, { stage2Status: "confirmed" });
  } else {
    await updateSessionStatus(session.id, { stage2Status: "in_progress" });
  }

  return Response.json({ type: toolUse.name, data: parsed.data });
}
