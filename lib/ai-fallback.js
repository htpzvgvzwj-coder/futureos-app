import { deepCleanStrayEscapes, extractText, findToolUse, getAnthropicClient, runToolTurn, WEDDING_MODEL } from "./anthropic-client.js";

// Provider-agnostic fallback for single-shot tool-forced calls (no
// conversation history - see the header note below for why multi-turn
// domains use a different, already-existing resilience strategy instead).
// Anthropic stays the primary path with zero behavior change from a direct
// call, groq/gemini are plain-fetch fallbacks (no new SDK dependency, same
// convention as lib/voice-providers.js) tried only if the provider ahead of
// them THROWS - a real API/network failure (rate limit, credit exhaustion -
// the actual incident that motivated this, timeout). A clean refusal or "no
// tool call" outcome from whichever provider actually answered is NOT a
// failure and does not cascade to the next provider, since that would
// silently change what the customer is told rather than just improve
// uptime.
//
// Deliberately NOT used for the 11 multi-turn conversational routes
// (wedding/home/retirement/other's stage1/stage2, investment/stage1,
// loan/stage1, decision/check) - those already have a considered, working
// resilience strategy (a deterministic local mock per domain, see
// lib/{wedding,home,...}-mock.js), and giving them a second real-AI-provider
// fallback would also require translating Anthropic's tool_use/tool_result
// conversation history into each other provider's own multi-turn format -
// real, unsolved complexity this module does not attempt. Only used by
// single-shot routes (Mirror debate, Decode This) where there is no
// conversation history to translate.

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function providerOrder() {
  const order = [];
  if (process.env.ANTHROPIC_API_KEY) order.push("anthropic");
  if (process.env.GROQ_API_KEY) order.push("groq");
  if (process.env.GEMINI_API_KEY) order.push("gemini");
  return order;
}

function toFunctionSchema(tool) {
  return { name: tool.name, description: tool.description, parameters: tool.input_schema };
}

async function callAnthropic(systemPrompt, tool, userMessage) {
  const response = await runToolTurn(getAnthropicClient(), {
    model: WEDDING_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });
  if (response.stop_reason === "refusal") {
    return { refusal: true, toolInput: null, rawText: extractText(response.content) };
  }
  const toolUse = findToolUse(response.content, [tool.name]);
  if (!toolUse) {
    return { refusal: false, toolInput: null, rawText: extractText(response.content) };
  }
  return { refusal: false, toolInput: deepCleanStrayEscapes(toolUse.input), rawText: "" };
}

async function callGroq(systemPrompt, tool, userMessage) {
  const schema = toFunctionSchema(tool);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      tools: [{ type: "function", function: schema }],
      tool_choice: { type: "function", function: { name: schema.name } },
    }),
  });
  if (!response.ok) {
    throw new Error(`groq_call_failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    return { refusal: true, toolInput: null, rawText: message.refusal };
  }
  const call = message?.tool_calls?.[0];
  if (!call) {
    return { refusal: false, toolInput: null, rawText: message?.content ?? "" };
  }
  return { refusal: false, toolInput: deepCleanStrayEscapes(JSON.parse(call.function.arguments)), rawText: "" };
}

async function callGemini(systemPrompt, tool, userMessage) {
  const schema = toFunctionSchema(tool);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        tools: [{ functionDeclarations: [schema] }],
        tool_config: { function_calling_config: { mode: "ANY" } },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`gemini_call_failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const call = parts.find((part) => part.functionCall)?.functionCall;
  if (!call) {
    const text = parts.map((part) => part.text).filter(Boolean).join("\n");
    return { refusal: false, toolInput: null, rawText: text };
  }
  return { refusal: false, toolInput: deepCleanStrayEscapes(call.args), rawText: "" };
}

const CALLERS = { anthropic: callAnthropic, groq: callGroq, gemini: callGemini };

// Tries each configured provider in providerOrder(); only advances to the
// next one when a provider's call THROWS. Returns which provider actually
// answered (callers persist this as part of their own trace) plus every
// prior provider's failure reason for logging.
export async function runToolTurnWithFallback({ systemPrompt, tool, userMessage }) {
  const providers = providerOrder();
  if (!providers.length) {
    const error = new Error("no_ai_provider_configured");
    error.code = "not_configured";
    throw error;
  }
  const attempts = [];
  for (const provider of providers) {
    try {
      const result = await CALLERS[provider](systemPrompt, tool, userMessage);
      return { ...result, provider, attempts };
    } catch (error) {
      attempts.push({ provider, message: error.message });
    }
  }
  const error = new Error("all_ai_providers_failed");
  error.code = "all_providers_failed";
  error.attempts = attempts;
  throw error;
}
