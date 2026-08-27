import {
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildDealFinderSystemPrompt } from "../../../../lib/deal-finder-prompts.js";
import { PROPOSE_DEAL_OPTIONS_TOOL } from "../../../../lib/deal-finder-tools.js";
import { WEB_SEARCH_TOOL } from "../../../../lib/wedding-tools.js";
import { proposeDealOptionsSchema } from "../../../../lib/deal-finder-validation.js";
import { buildMockDealOptions } from "../../../../lib/deal-finder-mock.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 60;

// Stateless by design (no session/history table) - each search is its own
// real-time lookup, not a conversation to resume. Real runToolTurn (not
// the cross-provider fallback wrapper, which doesn't support web_search)
// with a local mock fallback on failure, same resilience shape as
// wedding/home/travel's stage1 routes.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { query, language } = body;
  if (typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "missing_query" }, { status: 400 });
  }

  const client = getAnthropicClient();
  let toolInput;
  let mocked = false;
  try {
    const response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildDealFinderSystemPrompt(language),
      tools: [WEB_SEARCH_TOOL, PROPOSE_DEAL_OPTIONS_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: query.trim() }],
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    const toolUse = findToolUse(response.content, ["propose_deal_options"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    toolInput = deepCleanStrayEscapes(toolUse.input);
  } catch (error) {
    console.error("deal-finder/search Anthropic call failed, falling back to mock response", error);
    toolInput = buildMockDealOptions(query.trim());
    mocked = true;
  }

  const parsed = proposeDealOptionsSchema.safeParse(toolInput);
  if (!parsed.success) {
    console.error("deal-finder/search tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  return Response.json({ result: parsed.data, mocked });
}
