import { getCurrentUserId } from "../../../lib/auth.js";
import { getLifeJourneyStatus } from "../../../lib/life-journey-context.js";

export const runtime = "nodejs";

// Real per-domain status for the Life Journey screen (see
// lib/life-journey-context.js) - recomputed fresh on every read, no cron
// infra in this app, same pattern as follow-through/strategic-balance.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const status = await getLifeJourneyStatus(userId);
  return Response.json({ status });
}
