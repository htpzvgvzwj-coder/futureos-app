import { getCurrentUserId } from "../../../lib/auth.js";
import { buildFinancialTwinBundle } from "../../../lib/financial-twin/bundle.js";

export const runtime = "nodejs";

// GET /api/financial-twin
// The one canonical money picture: the Financial Twin + Safe-to-Spend +
// Future Balance + any Money Rescue cases + Reality Drift. Every Studio,
// Today, Life, Guardian and the Money Moments aggregator read from the same
// builder (lib/financial-twin/bundle.js) so no two of them disagree.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const b = await buildFinancialTwinBundle(userId);
    return Response.json({
      asOf: b.asOf,
      twin: b.twin,
      balances: b.balances,
      holdings: b.holdings,
      recentTransactions: b.recentTransactions,
      safeToSpend: b.safeToSpend,
      futureBalance: b.futureBalance,
      realityDrift: b.realityDrift,
      rescueCases: b.rescueCases,
      spendingLast90Days: b.spendingLast90Days,
      counts: b.counts,
      isEmpty: b.isEmpty,
    });
  } catch (error) {
    console.error("[financial-twin] build failed:", error?.message);
    return Response.json({ error: "financial_twin_unavailable" }, { status: 500 });
  }
}
