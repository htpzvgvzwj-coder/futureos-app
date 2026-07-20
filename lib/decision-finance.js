// Deterministic "will this affect my other goals" verdict for Mirror's point-of-decision Quick
// Verdict tool. No AI involved in the numbers or the verdict category at all - every dollar figure
// and the verdict itself come from the same real cashflow arithmetic used across the rest of the
// app (see lib/loan-finance.js's computeFutureScore). AI (lib/decision-tools.js) only narrates a
// verdict that is already fully decided by the time it sees it - the strictest form of "AI touches
// zero numbers" in this codebase, and the reason this tool can return an answer instantly, even if
// the AI narration call fails and falls back to a mock template.

export const VERDICT_CATEGORIES = ["go_ahead", "proceed_with_caution", "reconsider"];

function classifyVerdict({ residualMonthlyAfter, monthlyIncome, emergencyFundMonthsAfter }) {
  if (residualMonthlyAfter < 0 || emergencyFundMonthsAfter < 1) return "reconsider";
  if (residualMonthlyAfter < monthlyIncome * 0.1 || emergencyFundMonthsAfter < 3) return "proceed_with_caution";
  return "go_ahead";
}

export function computeDecisionVerdict({
  amount,
  recurringMonthly = 0,
  monthlyIncome,
  monthlyExpenses,
  currentSavings,
  otherGoalsMonthlyOutflow,
}) {
  const residualMonthlyAfter = Math.round(monthlyIncome - monthlyExpenses - otherGoalsMonthlyOutflow - recurringMonthly);
  const savingsAfterOutlay = Math.max(0, currentSavings - amount);
  const emergencyFundMonthsBefore = monthlyExpenses > 0 ? Math.round((currentSavings / monthlyExpenses) * 10) / 10 : 0;
  const emergencyFundMonthsAfter = monthlyExpenses > 0 ? Math.round((savingsAfterOutlay / monthlyExpenses) * 10) / 10 : 0;

  const verdict = classifyVerdict({ residualMonthlyAfter, monthlyIncome, emergencyFundMonthsAfter });

  return {
    verdict,
    amount: Math.round(amount),
    recurring_monthly: Math.round(recurringMonthly),
    residual_monthly_after: residualMonthlyAfter,
    emergency_fund_months_before: emergencyFundMonthsBefore,
    emergency_fund_months_after: emergencyFundMonthsAfter,
    other_goals_monthly_outflow: Math.round(otherGoalsMonthlyOutflow),
  };
}
