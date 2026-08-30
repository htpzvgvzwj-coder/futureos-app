import { getCurrentUserId } from "../../../lib/auth.js";
import { buildLifeThread } from "../../../lib/life-thread/service.js";

export const runtime = "nodejs";

// GET /api/life-thread - the one canonical snapshot Today / Life / Explore /
// Guardian all read. Clients refetch this (not their own derived state)
// after any peel / allocation / Seal / revoke / handoff.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const thread = await buildLifeThread(userId);
    return Response.json(thread);
  } catch (error) {
    console.error("[life-thread] build failed:", error?.message);
    return Response.json({ error: "life_thread_unavailable" }, { status: 500 });
  }
}
