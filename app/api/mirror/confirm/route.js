import { confirmDebate } from "../../../../lib/mirror-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// Marks a debate as the one the customer actually committed to, distinct
// from one they only previewed - this is what a future job would scan to
// check whether the bear case's flagged risk (bear_risk_tag) actually
// happened, and feed that back into Guardian Reputation Score.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { debateId } = body;
  if (typeof debateId !== "string") {
    return Response.json({ error: "missing_debate_id" }, { status: 400 });
  }

  const updated = await confirmDebate(userId, debateId);
  if (!updated) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ confirmed: true });
}
