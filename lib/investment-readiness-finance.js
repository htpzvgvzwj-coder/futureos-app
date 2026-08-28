// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// The real gate the Investment Planner asks BEFORE showing any product:
// "is this money suitable to invest right now", not just "here are some
// funds". Reuses the exact same 6-month emergency-fund target
// app/page.jsx's getHealthScores already uses (emergencyTarget =
// expenses * 6) rather than inventing a second threshold, and the same
// real credit-card-outstanding field Peer Benchmark already reads.

export const EMERGENCY_FUND_MONTHS_TARGET = 6;

export function computeInvestmentReadiness({ currentSavings, monthlyExpenses, creditCardOutstanding, availableMonthlyCashflow }) {
  const emergencyFundMonths = monthlyExpenses > 0 ? Math.round((currentSavings / monthlyExpenses) * 10) / 10 : 0;
  const hasEmergencyBuffer = emergencyFundMonths >= EMERGENCY_FUND_MONTHS_TARGET;
  const hasHighCostDebt = creditCardOutstanding > 0;

  let readiness;
  if (!hasEmergencyBuffer) readiness = "buildBufferFirst";
  else if (hasHighCostDebt) readiness = "payDownDebtFirst";
  else if (availableMonthlyCashflow <= 0) readiness = "noRoomYet";
  else readiness = "readyToInvest";

  return {
    readiness,
    emergencyFundMonths,
    emergencyFundTarget: EMERGENCY_FUND_MONTHS_TARGET,
    hasEmergencyBuffer,
    hasHighCostDebt,
    creditCardOutstanding: Math.round(creditCardOutstanding),
    availableMonthlyCashflow: Math.round(availableMonthlyCashflow),
  };
}
