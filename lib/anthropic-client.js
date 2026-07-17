import Anthropic from "@anthropic-ai/sdk";

let client;

export function getAnthropicClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const WEDDING_MODEL = "claude-sonnet-5";

// Finds the last tool_use block in a response content array matching one of
// `toolNames`. Returns null if the model ended the turn without calling one
// of them (e.g. plain text, or a refusal) — callers must handle that case
// explicitly rather than assuming a tool call always happened.
export function findToolUse(content, toolNames) {
  for (let i = content.length - 1; i >= 0; i -= 1) {
    const block = content[i];
    if (block.type === "tool_use" && toolNames.includes(block.name)) {
      return block;
    }
  }
  return null;
}

// Claude occasionally double-escapes unicode inside tool-call JSON string
// values (e.g. emits the 6 literal characters – instead of the dash
// character itself), which survives a single JSON.parse as literal text.
// Clean it recursively before validating/displaying tool output.
export function deepCleanStrayEscapes(value) {
  if (typeof value === "string") {
    return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  if (Array.isArray(value)) {
    return value.map(deepCleanStrayEscapes);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, deepCleanStrayEscapes(val)]));
  }
  return value;
}

export function extractText(content) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

// Every one of our turns ends with a custom tool_use (propose_plans /
// confirm_wedding_budget / propose_savings_plan / finalize_savings_plan),
// which the API requires a matching tool_result for before the next
// non-tool-result user turn. Since these tools are used purely as a
// structured-output mechanism (we never actually execute them and reply),
// we synthesize an acknowledgement tool_result here rather than making the
// caller track pending tool_use ids across requests.
export function buildFollowUpUserContent(history, text) {
  const last = history[history.length - 1];
  const content = [];
  if (last?.role === "assistant") {
    const pendingToolUse = last.content.find((block) => block.type === "tool_use");
    if (pendingToolUse) {
      content.push({
        type: "tool_result",
        tool_use_id: pendingToolUse.id,
        content: "Acknowledged — the customer has seen this and is responding.",
      });
    }
  }
  content.push({ type: "text", text });
  return content;
}

// Server-side tools (web_search) run in a loop capped at 10 iterations per
// turn; hitting the cap returns stop_reason "pause_turn" rather than ending
// the turn. Resume by resending the assistant's partial response — the
// server continues where it left off. Do NOT add an extra user message.
export async function runToolTurn(client, params) {
  const messages = [...params.messages];
  let response = await client.messages.create({ ...params, messages });
  while (response.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create({ ...params, messages });
  }
  return response;
}
