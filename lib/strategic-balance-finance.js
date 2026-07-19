// Deterministic engine for Strategic Balance (张力全景). Same "AI touches
// zero numbers" discipline as every other *-finance.js module in this
// codebase — this module is pure arithmetic over real confirmed-plan data
// (lib/strategic-balance-context.js) and real profile inputs; nothing here
// is invented or AI-sourced.

import { computeFutureScore } from "./loan-finance.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function healthLabel(residualIncome, monthlyIncome) {
  if (residualIncome >= monthlyIncome * 0.1) return "on_track";
  if (residualIncome >= 0) return "tight";
  return "at_risk";
}

// Overall cashflow-utilization snapshot — same on_track/tight/at_risk
// convention lib/loan-finance.js uses for a single loan, applied here to
// the customer's total committed monthly outflow across every confirmed
// goal at once.
export function computeUtilization({ monthlyIncome, monthlyExpenses, committedMonthlyTotal }) {
  const residualIncome = monthlyIncome - monthlyExpenses - committedMonthlyTotal;
  const utilizationPercent = monthlyIncome > 0 ? clamp(Math.round((committedMonthlyTotal / monthlyIncome) * 100), 0, 100) : 0;
  return {
    utilizationPercent,
    healthLabel: healthLabel(residualIncome, monthlyIncome),
    residualMonthly: Math.round(residualIncome),
  };
}

// `events`: every confirmed commitment as { confirmedAt, monthlyDelta }.
// Walks them in real confirmation order and expresses the running total as
// a percentage of the CUSTOMER'S CURRENT income (stated simplification —
// this app has no historical income snapshots to map against instead) so
// the trend line is built entirely from real dated events, never a
// fabricated slope. Returns null when there are fewer than 2 dated points:
// a single point isn't a trend, and showing one anyway would silently
// invent a direction.
export function computeUtilizationTimeline(events, monthlyIncome) {
  const dated = events.filter((event) => event.confirmedAt).sort((a, b) => new Date(a.confirmedAt) - new Date(b.confirmedAt));
  if (dated.length < 2 || monthlyIncome <= 0) return null;

  let running = 0;
  const points = dated.map((event) => {
    running += event.monthlyDelta;
    return { date: event.confirmedAt, utilizationPercent: clamp(Math.round((running / monthlyIncome) * 100), 0, 100) };
  });

  const first = points[0].utilizationPercent;
  const last = points[points.length - 1].utilizationPercent;
  return {
    points,
    changePercentPoints: last - first,
    direction: last > first ? "up" : last < first ? "down" : "flat",
  };
}

// "Try adjusting" preview for the investment monthly commitment — recomputes
// overall utilization AND every confirmed loan's Future Score with the
// hypothetical investment amount folded into otherGoalsMonthlyOutflow, via
// the exact same lib/loan-finance.js formula the Loan Planner itself uses.
// Nothing here is persisted; this is a live "what if" preview only.
export function simulateInvestmentAdjustment({
  newInvestmentMonthly,
  confirmedLoans,
  otherNonInvestmentMonthlyOutflow,
  monthlyIncome,
  monthlyExpenses,
  currentSavings,
}) {
  const committedMonthlyTotal = otherNonInvestmentMonthlyOutflow + confirmedLoans.reduce((sum, loan) => sum + loan.monthlyInstallment, 0) + newInvestmentMonthly;
  const utilization = computeUtilization({ monthlyIncome, monthlyExpenses, committedMonthlyTotal });

  const loans = confirmedLoans.map((loan) => {
    const otherLoansTotal = confirmedLoans.filter((other) => other !== loan).reduce((sum, other) => sum + other.monthlyInstallment, 0);
    const otherGoalsMonthlyOutflow = otherNonInvestmentMonthlyOutflow + otherLoansTotal + newInvestmentMonthly;
    const recomputed = computeFutureScore({
      monthlyInstallment: loan.monthlyInstallment,
      monthlyIncome,
      monthlyExpenses,
      currentSavings,
      extraCashUsed: 0,
      otherGoalsMonthlyOutflow,
    });
    return { purpose: loan.purpose, previousFutureScore: loan.futureScore, newFutureScore: recomputed.future_score };
  });

  return { utilization, loans };
}
