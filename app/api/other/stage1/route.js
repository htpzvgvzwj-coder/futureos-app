import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildStage1SystemPrompt } from "../../../../lib/other-prompts.js";
import { CONFIRM_GOAL_PLAN_TOOL, PROPOSE_PLANS_TOOL, WEB_SEARCH_TOOL } from "../../../../lib/other-tools.js";
import { confirmGoalPlanSchema, proposePlansSchema } from "../../../../lib/other-validation.js";
import { buildMockGoalConfirmation, buildMockPlanOptions, looksLikeConfirmation } from "../../../../lib/other-mock.js";
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/other-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

// Falls back to a local template response only when the real Anthropic call itself fails (e.g. no
// API credits during development) - never used just because the model said something unexpected.
// Once a real ANTHROPIC_API_KEY with credit is configured, this path is simply never reached.
async function buildMockToolUse(message, sessionId) {
  const previousPlanOptions = await getLatestArtifact(sessionId, "stage1", "plan_options");
  if (looksLikeConfirmation(message) && previousPlanOptions) {
    return { name: "confirm_goal_plan", input: buildMockGoalConfirmation(message, previousPlanOptions), mocked: true };
  }
  return { name: "propose_plans", input: buildMockPlanOptions(message), mocked: true };
}

export async function POST(request) {
  const body = await request.json();
  const { intent, message, language } = body;

  if (!VALID_INTENTS.has(intent)) {
    return Response.json({ error: "invalid_intent" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
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
      output_config: { effort: "medium" },
      system: buildStage1SystemPrompt(language),
      tools: [WEB_SEARCH_TOOL, PROPOSE_PLANS_TOOL, CONFIRM_GOAL_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    toolUse = findToolUse(response.content, ["propose_plans", "confirm_goal_plan"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    assistantContent = response.content;
  } catch (error) {
    console.error("other/stage1 Anthropic call failed, falling back to mock response", error);
    toolUse = await buildMockToolUse(message, session.id);
    mocked = true;
    assistantContent = [{ type: "tool_use", id: `mock-${Date.now()}`, name: toolUse.name, input: toolUse.input }];
  }

  const schema = toolUse.name === "propose_plans" ? proposePlansSchema : confirmGoalPlanSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("other/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);

  const artifactType = toolUse.name === "propose_plans" ? "plan_options" : "confirmed_goal_plan";
  const createdAt = await saveArtifact(session.id, "stage1", artifactType, parsed.data);

  if (toolUse.name === "confirm_goal_plan") {
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
  }

  return Response.json({
    type: toolUse.name,
    data: parsed.data,
    confirmedAt: toolUse.name === "confirm_goal_plan" ? createdAt : undefined,
    mocked,
  });
}
