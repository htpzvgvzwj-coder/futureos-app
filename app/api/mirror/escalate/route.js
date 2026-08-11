import { escalateDebate } from "../../../../lib/mirror-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// Records a real request for a Relationship Manager follow-up on a specific
// low-confidence debate - mirrors app/api/mirror/confirm/route.js exactly.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { debateId } = body;
  if (typeof debateId !== "string") {
    return Response.json({ error: "missing_debate_id" }, { status: 400 });
  }

  const updated = await escalateDebate(userId, debateId);
  if (!updated) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ escalated: true });
}
