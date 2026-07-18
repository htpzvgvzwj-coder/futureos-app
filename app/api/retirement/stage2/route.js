import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildRetirementStage2SystemPrompt } from "../../../../lib/retirement-prompts.js";
import { FINALIZE_RETIREMENT_SAVINGS_PLAN_TOOL, PROPOSE_RETIREMENT_SAVINGS_PLAN_TOOL } from "../../../../lib/retirement-tools.js";
import { finalizeRetirementSavingsPlanSchema, proposeRetirementSavingsPlanSchema } from "../../../../lib/retirement-validation.js";
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/retirement-store.js";

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
      system: buildRetirementStage2SystemPrompt(language, profile, confirmedPlan),
      tools: [PROPOSE_RETIREMENT_SAVINGS_PLAN_TOOL, FINALIZE_RETIREMENT_SAVINGS_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
  } catch (error) {
    console.error("retirement/stage2 Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["propose_retirement_savings_plan", "finalize_retirement_savings_plan"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const schema =
    toolUse.name === "propose_retirement_savings_plan"
      ? proposeRetirementSavingsPlanSchema
      : finalizeRetirementSavingsPlanSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("retirement/stage2 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage2", [
    { role: "user", content: userContent },
    { role: "assistant", content: response.content },
  ]);

  const artifactType = toolUse.name === "propose_retirement_savings_plan" ? "savings_plan_options" : "confirmed_savings_plan";
  await saveArtifact(session.id, "stage2", artifactType, parsed.data);

  if (toolUse.name === "finalize_retirement_savings_plan") {
    await updateSessionStatus(session.id, { stage2Status: "confirmed" });
  } else {
    await updateSessionStatus(session.id, { stage2Status: "in_progress" });
  }

  return Response.json({ type: toolUse.name, data: parsed.data });
}
