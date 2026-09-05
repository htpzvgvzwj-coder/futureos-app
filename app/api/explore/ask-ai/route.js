import { getCurrentUserId } from "../../../../lib/auth.js";
import { guard } from "../../../../lib/http-guards.js";
import { buildLifeThread } from "../../../../lib/life-thread/service.js";
import { getAnthropicClient, extractText, WEDDING_MODEL } from "../../../../lib/anthropic-client.js";
import { buildAskAiSystemPrompt } from "../../../../lib/explore/ask-ai-prompt.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/explore/ask-ai { question } -> { reply }
//
// The Explore hero's "explain, don't act" layer: reads this account's real
// Life Thread numbers, asks Claude to answer the typed question grounded
// only in those, and returns plain text. No tool calls, no session, no
// side effect on the account — a single stateless turn. The existing
// routeForQuestion() / Future Field navigation is untouched; this is
// shown alongside it, not instead of it.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "explore_ask_ai", limit: 20 });
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 400) {
    return Response.json({ error: "invalid_question" }, { status: 400 });
  }

  let lt;
  try {
    lt = await buildLifeThread(userId);
  } catch (error) {
    console.error("[explore/ask-ai] buildLifeThread failed:", error?.message);
    return Response.json({ error: "data_unavailable" }, { status: 500 });
  }

  const client = getAnthropicClient();
  let response;
  try {
    response = await client.messages.create({
      model: WEDDING_MODEL,
      max_tokens: 400,
      system: buildAskAiSystemPrompt(lt),
      messages: [{ role: "user", content: question }],
    });
  } catch (error) {
    console.error("[explore/ask-ai] Anthropic call failed:", error?.message);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const reply = extractText(response.content);
  if (!reply) return Response.json({ error: "empty_reply" }, { status: 502 });

  return Response.json({ reply, estimate: true });
}
