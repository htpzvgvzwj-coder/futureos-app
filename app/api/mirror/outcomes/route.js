import { getCurrentUserId } from "../../../../lib/auth.js";
import { resolveDebateOutcomes } from "../../../../lib/mirror-outcome-resolver.js";
import { getResolvedDebateStats } from "../../../../lib/mirror-store.js";

export const runtime = "nodejs";

// No cron/background-job infrastructure exists in this app - every cross-domain
// snapshot (follow-through, strategic-balance) is recomputed fresh on read instead
// of on a schedule, and this follows the same pattern: check for newly-resolvable
// debates every time this is read, then return the accountability stats.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await resolveDebateOutcomes(userId);
  const stats = await getResolvedDebateStats(userId);

  return Response.json({
    resolvedCount: stats.resolvedCount,
    predictiveAccuracy: stats.resolvedCount > 0 ? Math.round((stats.correctCount / stats.resolvedCount) * 100) : null,
  });
}
