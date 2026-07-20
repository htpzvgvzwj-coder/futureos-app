import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildLoanStage1SystemPrompt } from "../../../../lib/loan-prompts.js";
import { PROPOSE_LOAN_SIZING_TOOL, WEB_SEARCH_TOOL } from "../../../../lib/loan-tools.js";
import { proposeLoanSizingSchema } from "../../../../lib/loan-validation.js";
import { buildMockSizingOptions } from "../../../../lib/loan-mock.js";
import { appendMessages, DEFAULT_PROFILE_KEY, getMessageHistory, getOrCreateSession, saveArtifact } from "../../../../lib/loan-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);
// "home" never reaches this route — its principal is read directly from the
// already-confirmed Home Purchase Plan (lib/loan-context.js).
const SIZING_PURPOSES = new Set(["renovation", "personal"]);

export async function POST(request) {
  const body = await request.json();
  const { intent, message, language, purpose } = body;

  if (!VALID_INTENTS.has(intent)) {
    return Response.json({ error: "invalid_intent" }, { status: 400 });
  }
  if (!SIZING_PURPOSES.has(purpose)) {
    return Response.json({ error: "invalid_purpose" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY, purpose);
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
      max_tokens: 5000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildLoanStage1SystemPrompt(language, purpose),
      tools: [WEB_SEARCH_TOOL, PROPOSE_LOAN_SIZING_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    toolUse = findToolUse(response.content, ["propose_loan_sizing"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    assistantContent = response.content;
  } catch (error) {
    console.error("loan/stage1 Anthropic call failed, falling back to mock response", error);
    const input = buildMockSizingOptions(purpose);
    toolUse = { name: "propose_loan_sizing", input };
    mocked = true;
    assistantContent = [{ type: "tool_use", id: `mock-${Date.now()}`, name: toolUse.name, input: toolUse.input }];
  }

  const parsed = proposeLoanSizingSchema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("loan/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);

  await saveArtifact(session.id, "stage1", "sizing_options", parsed.data);

  return Response.json({ type: toolUse.name, data: parsed.data, mocked });
}
