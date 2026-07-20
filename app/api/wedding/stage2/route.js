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
  DEFAULT_PROFILE_KEY,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/wedding-store.js";

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
      system: buildStage2SystemPrompt(language, profile, confirmedBudget),
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
    toolUse = await buildMockToolUse(message, session.id, confirmedBudget, profile);
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

  const artifactType = toolUse.name === "propose_savings_plan" ? "savings_plan_options" : "confirmed_savings_plan";
  await saveArtifact(session.id, "stage2", artifactType, parsed.data);

  if (toolUse.name === "finalize_savings_plan") {
    await updateSessionStatus(session.id, { stage2Status: "confirmed" });
  } else {
    await updateSessionStatus(session.id, { stage2Status: "in_progress" });
  }

  return Response.json({ type: toolUse.name, data: parsed.data, mocked });
}
