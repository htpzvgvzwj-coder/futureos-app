import { getOtherGoalsMonthlyCommitment, getRetirementGap } from "../../../../lib/investment-context.js";

export const runtime = "nodejs";

// Read-only cross-goal context, fetched before intake so the UI can show
// real available monthly cashflow and offer the retirement_gap goal
// category only when a confirmed retirement gap actually exists. The
// intake/confirm endpoints independently re-fetch this server-side — a
// stale or failed client fetch here can never corrupt what gets persisted.
export async function GET() {
  const [otherGoals, retirementGap] = await Promise.all([getOtherGoalsMonthlyCommitment(), getRetirementGap()]);

  return Response.json({
    otherGoalsMonthlyOutflow: otherGoals.total,
    retirementGap,
  });
}
