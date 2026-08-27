// "Future Comparison" - two real, deterministic projections of the same
// horizon (buy this now vs don't), computed from the customer's real
// income/expenses/savings and every already-confirmed loan/investment on
// file - never a narrated guess. Same "AI touches zero numbers" discipline
// as every other *-finance.js module: this file decides both numbers
// completely; an AI narration layer (if any) only describes what's already
// decided, same relationship computeDecisionVerdict has to Quick Verdict's
// narration.
//
// Deliberately reuses lib/cross-goal-context.js's real loan/investment
// impact math (computeLoanImpact/computeInvestmentImpact) rather than a
// second formula - "if I commit this extra recurring cost, what happens to
// my already-confirmed loan/investment Future Scores" is exactly the same
// question Guardian's proactive cross-goal risk check already answers, just
// asked for a hypothetical the customer hasn't committed to yet instead of
// something already confirmed.
import { getCrossGoalSnapshot, computeLoanImpact, computeInvestmentImpact } from "./cross-goal-context.js";

function projectScenario({ amount, recurringMonthly, horizonMonths, monthlyIncome, monthlyExpenses, currentSavings, committedMonthlyTotal, loans, investments }) {
  const residualMonthly = Math.round(monthlyIncome - monthlyExpenses - committedMonthlyTotal - recurringMonthly);
  const savingsAfterOutlay = Math.max(0, currentSavings - amount);
  const savingsAtHorizon = Math.max(0, Math.round(savingsAfterOutlay + residualMonthly * horizonMonths));
  const emergencyFundMonthsAtHorizon = monthlyExpenses > 0 ? Math.round((savingsAtHorizon / monthlyExpenses) * 10) / 10 : 0;

  const sharedArgs = { monthlyIncome, monthlyExpenses, currentSavings: savingsAfterOutlay, committedMonthlyTotal };
  const loanImpact = computeLoanImpact(loans, recurringMonthly, sharedArgs);
  const investmentImpact = computeInvestmentImpact(investments, recurringMonthly, sharedArgs);

  return { residualMonthly, savingsAtHorizon, emergencyFundMonthsAtHorizon, loanImpact, investmentImpact };
}

// `horizonMonths` deliberately capped/validated by the caller (route
// schema), not here - this module trusts its inputs are already real
// numbers, same convention as every sibling *-finance.js file.
export async function computeFutureComparison(profileKey, { amount, recurringMonthly = 0, horizonMonths, monthlyIncome, monthlyExpenses, currentSavings }) {
  const { loans, investments, committedMonthlyTotal } = await getCrossGoalSnapshot(profileKey);

  // "Buy it now": the one-time amount comes out of savings immediately,
  // and the recurring cost (if any) is layered onto every already-
  // confirmed commitment for the whole horizon, exactly like a customer's
  // real ongoing subscription/installment would be.
  const buyNow = projectScenario({
    amount,
    recurringMonthly,
    horizonMonths,
    monthlyIncome,
    monthlyExpenses,
    currentSavings,
    committedMonthlyTotal,
    loans,
    investments,
  });

  // "Wait instead": no outlay, no new recurring cost - the same real
  // committed total keeps accumulating against savings untouched.
  const waitInstead = projectScenario({
    amount: 0,
    recurringMonthly: 0,
    horizonMonths,
    monthlyIncome,
    monthlyExpenses,
    currentSavings,
    committedMonthlyTotal,
    loans,
    investments,
  });

  const worseningGoals = [...buyNow.loanImpact, ...buyNow.investmentImpact].filter((item) => item.delta <= -10);

  return {
    horizonMonths,
    amount: Math.round(amount),
    recurringMonthly: Math.round(recurringMonthly),
    committedMonthlyTotal: Math.round(committedMonthlyTotal),
    buyNow,
    waitInstead,
    savingsDelta: waitInstead.savingsAtHorizon - buyNow.savingsAtHorizon,
    worseningGoals,
  };
}
