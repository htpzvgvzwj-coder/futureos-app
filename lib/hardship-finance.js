// Deterministic hardship-recovery calculators. Same discipline as
// lib/home-finance.js and lib/retirement-finance.js: the AI classifies and
// describes the customer's situation, but every dollar figure here — the
// monthly gap, how many months a withdrawal covers, the windfall split — is
// computed by code, never trusted from the model.
//
// Home's projected monthly_installment is deliberately NOT counted as a
// current committed outflow: nobody in this app's data model has actually
// purchased a home yet (every confirmed home plan is still in the
// down-payment savings phase), so that figure is a future projection, not a
// bill currently being paid. Only real current confirmed_savings_plan
// contributions across wedding/home/retirement, plus monthly_expenses,
// count toward "what's squeezing you right now."

export function computeCommittedMonthlyOutflow(commitments, monthlyExpenses) {
  const perDomain = ["wedding", "home", "retirement"].map((domain) => ({
    domain,
    monthly: commitments[domain]?.confirmedSavingsPlan?.monthly_contribution ?? 0,
  }));
  const totalGoalSavings = perDomain.reduce((sum, d) => sum + d.monthly, 0);
  return {
    perDomain,
    totalGoalSavings,
    monthlyExpenses,
    totalCommittedOutflow: totalGoalSavings + monthlyExpenses,
  };
}

export function computeIncomeGap({ totalCommittedOutflow, statedNewMonthlyIncome, priorMonthlyIncome }) {
  const income = statedNewMonthlyIncome ?? priorMonthlyIncome;
  const monthlyShortfall = Math.max(0, Math.round(totalCommittedOutflow - income));
  return { income, monthlyShortfall, hasShortfall: monthlyShortfall > 0 };
}

export function monthsCovered(amount, monthlyShortfall) {
  return monthlyShortfall > 0 ? Math.round((amount / monthlyShortfall) * 10) / 10 : null;
}

// Conservative default runway before asking the customer for a different
// amount via a follow-up ("refine") message — not baked in silently, always
// surfaced alongside the months-covered figure it produces.
export const DEFAULT_COVERAGE_MONTHS = 3;

export function computeDefaultDrawdown({ currentFund, monthlyShortfall }) {
  const suggested = Math.min(currentFund, Math.round(monthlyShortfall * DEFAULT_COVERAGE_MONTHS));
  return { suggested, monthsCovered: monthsCovered(suggested, monthlyShortfall) };
}

// Code owns the entire gap-vs-excess boundary — only the excess portion of a
// stated windfall is ever eligible for the small-investment suggestion.
export function computeWindfallSplit({ statedWindfallAmount, monthlyShortfall, coverageMonths = DEFAULT_COVERAGE_MONTHS }) {
  const amountNeededForGap = Math.min(statedWindfallAmount, Math.round(monthlyShortfall * coverageMonths));
  const excessAvailable = Math.max(0, Math.round(statedWindfallAmount - amountNeededForGap));
  return { amountNeededForGap, excessAvailable, coverageMonths };
}
