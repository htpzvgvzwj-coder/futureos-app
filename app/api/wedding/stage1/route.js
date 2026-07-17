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
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/wedding-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine", "edit_activities"]);

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
  let response;
  try {
    response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: buildStage1SystemPrompt(language),
      tools: [WEB_SEARCH_TOOL, PROPOSE_PLANS_TOOL, CONFIRM_WEDDING_BUDGET_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
  } catch (error) {
    console.error("wedding/stage1 Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["propose_plans", "confirm_wedding_budget"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const schema = toolUse.name === "propose_plans" ? proposePlansSchema : confirmWeddingBudgetSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("wedding/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: response.content },
  ]);

  const artifactType = toolUse.name === "propose_plans" ? "plan_options" : "confirmed_budget";
  await saveArtifact(session.id, "stage1", artifactType, parsed.data);

  if (toolUse.name === "confirm_wedding_budget") {
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
  }

  return Response.json({ type: toolUse.name, data: parsed.data });
}
