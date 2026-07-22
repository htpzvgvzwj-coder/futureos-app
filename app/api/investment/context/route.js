import { getOtherGoalsMonthlyCommitment, getRetirementGap } from "../../../../lib/investment-context.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// Read-only cross-goal context, fetched before intake so the UI can show
// real available monthly cashflow and offer the retirement_gap goal
// category only when a confirmed retirement gap actually exists. The
// intake/confirm endpoints independently re-fetch this server-side — a
// stale or failed client fetch here can never corrupt what gets persisted.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [otherGoals, retirementGap] = await Promise.all([
    getOtherGoalsMonthlyCommitment(userId),
    getRetirementGap(userId),
  ]);

  return Response.json({
    otherGoalsMonthlyOutflow: otherGoals.total,
    retirementGap,
  });
}
