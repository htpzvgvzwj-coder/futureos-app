// Real cross-goal read/compute layer for Future Mirror's "whole-picture"
// debate mode and Guardian's proactive risk alerts. Mirror's debate
// (lib/mirror-finance.js) always evaluated ONE goal in isolation against
// income/expenses - this module is what lets it (and a new proactive
// post-confirm check) see the customer's REAL total committed outflow
// across every already-confirmed loan/investment/savings plan, and the
// real impact on an already-confirmed loan's own Future Score. Same "AI
// touches zero numbers" discipline as every other *-finance.js module -
// nothing here is invented or AI-sourced.

import { getStrategicBalanceSnapshot } from "./strategic-balance-context.js";
import { computeFutureScore } from "./loan-finance.js";

// Same convention as app/api/strategic-balance/snapshot/route.js's
// investmentMonthlyEquivalent - duplicated here (not imported across the
// route boundary) since route files aren't meant to be imported by lib
// modules. monthly_rsp/value_averaging amounts are already monthly
// figures; daily_micro_dca is a per-day amount (~21 trading days/month);
// lump_sum is a one-off draw on savings, not a recurring monthly outflow.
function investmentMonthlyEquivalent(pick) {
  if (pick.purchaseMode === "monthly_rsp" || pick.purchaseMode === "value_averaging") return pick.amount;
  if (pick.purchaseMode === "daily_micro_dca") return pick.amount * 21;
  return 0;
}

// Real committed monthly total across every confirmed loan/investment/
// savings-plan the customer already has, plus the real loan list needed to
// recompute each one's Future Score under a hypothetical.
export async function getCrossGoalSnapshot(profileKey) {
  const snapshot = await getStrategicBalanceSnapshot(profileKey);
  const loansTotal = snapshot.loans.reduce((sum, loan) => sum + loan.monthlyInstallment, 0);
  const investmentsTotal = snapshot.investments.reduce((sum, pick) => sum + investmentMonthlyEquivalent(pick), 0);
  const savingsTotal = snapshot.savings.reduce((sum, plan) => sum + plan.monthlyContribution, 0);
  return { loans: snapshot.loans, committedMonthlyTotal: loansTotal + investmentsTotal + savingsTotal };
}

// For each already-confirmed loan, recompute its real Future Score with a
// hypothetical extra monthly commitment layered on top of everything else
// already committed - the concrete "if you do this, your home loan's
// outlook drops from 72 to 58" number, using the exact same
// computeFutureScore formula that loan's own confirm route used.
function computeLoanImpact(loans, extraMonthlyCommitment, { monthlyIncome, monthlyExpenses, currentSavings, committedMonthlyTotal }) {
  return loans.map((loan) => {
    const otherGoalsMonthlyOutflow = committedMonthlyTotal - loan.monthlyInstallment + extraMonthlyCommitment;
    const after = computeFutureScore({
      monthlyInstallment: loan.monthlyInstallment,
      monthlyIncome,
      monthlyExpenses,
      currentSavings,
      extraCashUsed: 0,
      otherGoalsMonthlyOutflow,
    });
    return {
      purpose: loan.purpose,
      scoreBefore: loan.futureScore,
      scoreAfter: after.future_score,
      delta: after.future_score - loan.futureScore,
    };
  });
}

// Whole-picture impact of the goal being debated, layered on top of
// everything already confirmed. `computed` is computeGoalFeasibility's
// existing unchanged output (lib/mirror-finance.js) - this never mutates
// it, only adds a parallel view.
export function computeWholePictureImpact(computed, crossGoalSnapshot) {
  const { loans, committedMonthlyTotal } = crossGoalSnapshot;
  const loanImpact = computeLoanImpact(loans, computed.requiredMonthly, {
    monthlyIncome: computed.monthlyIncome,
    monthlyExpenses: computed.monthlyExpenses,
    currentSavings: computed.availableLiquidSavings,
    committedMonthlyTotal,
  });
  const wholePictureUtilizationPercent =
    computed.monthlyIncome > 0 ? Math.round(((committedMonthlyTotal + computed.requiredMonthly) / computed.monthlyIncome) * 100) : 0;
  const crossGoalRiskFlagged = wholePictureUtilizationPercent > 80 || loanImpact.some((loan) => loan.delta <= -10);

  return {
    committedMonthlyTotal: Math.round(committedMonthlyTotal),
    wholePictureUtilizationPercent,
    residualAfterAllCommitments: Math.round(computed.availableMonthly - committedMonthlyTotal - computed.requiredMonthly),
    loanImpact,
    crossGoalRiskFlagged,
  };
}

// Real post-confirm proactive check: does the CURRENT real committed total
// (already includes whatever was just confirmed) cross a risk threshold, or
// does it recompute any already-confirmed loan's Future Score meaningfully
// below its own stored value? Same math as computeWholePictureImpact, but
// evaluated against the real current state (extraMonthlyCommitment = 0)
// rather than a hypothetical addition - used by Guardian's proactive
// alerts (lib/guardian-alert-store.js), not by the debate.
export async function checkCrossGoalRisk(profileKey, { monthlyIncome, monthlyExpenses, currentSavings = 0 }) {
  const { loans, committedMonthlyTotal } = await getCrossGoalSnapshot(profileKey);
  const utilizationPercent = monthlyIncome > 0 ? Math.round((committedMonthlyTotal / monthlyIncome) * 100) : 0;
  const loanImpact = computeLoanImpact(loans, 0, { monthlyIncome, monthlyExpenses, currentSavings, committedMonthlyTotal });
  const worseningLoans = loanImpact.filter((loan) => loan.delta <= -10);
  const triggered = utilizationPercent > 80 || worseningLoans.length > 0;

  return { triggered, utilizationPercent, committedMonthlyTotal: Math.round(committedMonthlyTotal), worseningLoans };
}
