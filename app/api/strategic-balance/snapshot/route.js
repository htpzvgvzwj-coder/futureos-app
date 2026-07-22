import { getStrategicBalanceSnapshot } from "../../../../lib/strategic-balance-context.js";
import { computeUtilization, computeUtilizationTimeline } from "../../../../lib/strategic-balance-finance.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// monthly_rsp/value_averaging amounts are already monthly figures;
// daily_micro_dca is a per-day amount (~21 trading days/month); lump_sum is
// a one-off draw on savings, not a recurring monthly outflow — mirrors
// lib/investment-finance.js's deriveCommitmentForFutureScore logic.
function investmentMonthlyEquivalent(pick) {
  if (pick.purchaseMode === "monthly_rsp" || pick.purchaseMode === "value_averaging") return pick.amount;
  if (pick.purchaseMode === "daily_micro_dca") return pick.amount * 21;
  return 0;
}

export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const { searchParams } = new URL(request.url);
  const monthlyIncome = Number(searchParams.get("monthlyIncome")) || 0;
  const monthlyExpenses = Number(searchParams.get("monthlyExpenses")) || 0;
  const customGoalMonthly = Number(searchParams.get("customGoalMonthly")) || 0;
  const customGoalName = searchParams.get("customGoalName");
  const customGoalConfirmedAt = searchParams.get("customGoalConfirmedAt");

  const snapshot = await getStrategicBalanceSnapshot(resolved.profileKey);

  // Custom Goal has no backend store like wedding/home/retirement (lib/strategic-balance-context.js
  // SAVINGS_STORES) - it's a client-persisted preference, so its confirmed monthly contribution
  // arrives as a query param instead of a session read, and gets merged in here.
  if (customGoalMonthly > 0) {
    snapshot.savings = [
      ...snapshot.savings,
      {
        domain: "custom",
        label: customGoalName || null,
        monthlyContribution: customGoalMonthly,
        confirmedAt: customGoalConfirmedAt || null,
      },
    ];
  }

  const loansTotal = snapshot.loans.reduce((sum, loan) => sum + loan.monthlyInstallment, 0);
  const investmentsTotal = snapshot.investments.reduce((sum, pick) => sum + investmentMonthlyEquivalent(pick), 0);
  const savingsTotal = snapshot.savings.reduce((sum, plan) => sum + plan.monthlyContribution, 0);
  const committedMonthlyTotal = loansTotal + investmentsTotal + savingsTotal;

  const utilization = computeUtilization({ monthlyIncome, monthlyExpenses, committedMonthlyTotal });

  const timelineEvents = [
    ...snapshot.loans.map((loan) => ({ confirmedAt: loan.confirmedAt, monthlyDelta: loan.monthlyInstallment })),
    ...snapshot.investments.map((pick) => ({ confirmedAt: pick.confirmedAt, monthlyDelta: investmentMonthlyEquivalent(pick) })),
    ...snapshot.savings.map((plan) => ({ confirmedAt: plan.confirmedAt, monthlyDelta: plan.monthlyContribution })),
  ];
  const timeline = computeUtilizationTimeline(timelineEvents, monthlyIncome);

  return Response.json({
    loans: snapshot.loans,
    investments: snapshot.investments,
    savings: snapshot.savings,
    hardshipEvidence: snapshot.hardshipEvidence,
    loansMonthlyTotal: loansTotal,
    investmentsMonthlyTotal: investmentsTotal,
    savingsMonthlyTotal: savingsTotal,
    committedMonthlyTotal,
    utilization,
    timeline,
  });
}
