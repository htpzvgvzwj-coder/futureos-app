import { extractText } from "../../../../../lib/anthropic-client.js";
import { getMessageHistory, getOrCreateSession } from "../../../../../lib/mirror-chat-store.js";
import { getCurrentUserId } from "../../../../../lib/auth.js";

export const runtime = "nodejs";

// Flattens raw Anthropic content-block arrays (which may include thinking
// blocks alongside text) into plain display text before this ever reaches
// the client - the frontend renders chat bubbles, not content-block arrays.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const session = await getOrCreateSession(userId);
  const history = await getMessageHistory(session.id);

  const entries = history
    .map((message) => ({
      role: message.role,
      text: extractText(Array.isArray(message.content) ? message.content : []),
      debate: message.toolResults?.find((entry) => entry.name === "run_debate" && entry.result?.ok)?.result ?? null,
      context: message.context ?? null,
    }))
    .filter((entry) => entry.text || entry.debate);

  return Response.json({ entries });
}
