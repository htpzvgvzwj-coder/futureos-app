import { getCurrentUserId } from "../../../../lib/auth.js";
import { resolveDebateOutcomes } from "../../../../lib/mirror-outcome-resolver.js";
import { getResolvedDebateStats, getCustomerCalibrationStats, getRecentCalibratedDebates } from "../../../../lib/mirror-store.js";

export const runtime = "nodejs";

// No cron/background-job infrastructure exists in this app - every cross-domain
// snapshot (follow-through, strategic-balance) is recomputed fresh on read instead
// of on a schedule, and this follows the same pattern: check for newly-resolvable
// debates every time this is read, then return the accountability stats - both
// the AI's own (predictiveAccuracy) and the customer's own (Your Track Record).
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await resolveDebateOutcomes(userId);
  const [stats, calibrationStats, recentCalibrated] = await Promise.all([
    getResolvedDebateStats(userId),
    getCustomerCalibrationStats(userId),
    getRecentCalibratedDebates(userId),
  ]);

  return Response.json({
    resolvedCount: stats.resolvedCount,
    predictiveAccuracy: stats.resolvedCount > 0 ? Math.round((stats.correctCount / stats.resolvedCount) * 100) : null,
    customerCalibration: {
      resolvedCount: calibrationStats.resolvedCount,
      heldUpCount: calibrationStats.heldUpCount,
      recent: recentCalibrated.map((row) => ({
        id: row.id,
        goalType: row.goal_type,
        bearCase: row.bear_case,
        customerRebuttal: row.customer_rebuttal,
        resolvedOutcome: row.resolved_outcome,
        resolvedAt: row.resolved_at,
      })),
    },
  });
}
