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
  const { debateId, customerRebuttal } = body;
  if (typeof debateId !== "string") {
    return Response.json({ error: "missing_debate_id" }, { status: 400 });
  }
  if (customerRebuttal != null && (typeof customerRebuttal !== "string" || customerRebuttal.length > 1000)) {
    return Response.json({ error: "invalid_customer_rebuttal" }, { status: 400 });
  }

  const trimmedRebuttal = typeof customerRebuttal === "string" ? customerRebuttal.trim() : null;
  const updated = await confirmDebate(userId, debateId, trimmedRebuttal || null);
  if (!updated) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ confirmed: true });
}
