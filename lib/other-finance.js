// Deterministic feasibility math for the "Other" custom-goal domain. Unlike
// wedding (venue/photography/attire have real Singapore rate tables), an
// "Other" goal is genuinely open-ended - a trip, a gadget, a course,
// anything - so there is no honest way to compute its line-item COSTS
// server-side (lib/other-tools.js's header comment already explains this;
// that stays AI-estimated, by design). What CAN be computed deterministically
// once a cost and target date exist is whether the goal is actually
// affordable - the same real backstop every sibling domain has in some form
// (wedding's computeMilestoneFeasibility, mirror-finance.js's lump-sum
// path), which this domain has never had.

function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthCountUntil(targetDateISO, fallbackMonths = 12) {
  if (!targetDateISO) return fallbackMonths;
  const parsed = new Date(targetDateISO);
  if (Number.isNaN(parsed.getTime())) return fallbackMonths;
  const now = new Date();
  const months = (parsed.getFullYear() - now.getFullYear()) * 12 + (parsed.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

// Real affordability signal for the confirmed goal, computed fresh on every
// stage2 call (not persisted - it reflects the customer's CURRENT real
// income/expenses/liquid savings, not a snapshot). Same formula shape as
// mirror-finance.js's lump-sum-goal path: required-monthly is netted
// against real liquid savings already on hand, never the naive
// total-budget-divided-by-months a customer would compute by hand.
export function computeGoalFeasibility(confirmedPlan, { monthlyIncome, monthlyExpenses, availableLiquidSavings = 0 }) {
  const income = numberValue(monthlyIncome, 7500);
  const expenses = numberValue(monthlyExpenses, 3600);
  const availableMonthly = Math.max(income - expenses, 100);
  const targetAmount = numberValue(confirmedPlan.total_budget, 0);
  const monthsRemaining = monthCountUntil(confirmedPlan.target_date);
  const liquidSavings = Math.max(0, numberValue(availableLiquidSavings, 0));
  const remainingTarget = Math.max(0, targetAmount - liquidSavings);
  const requiredMonthly = Math.max(50, Math.ceil(remainingTarget / monthsRemaining / 50) * 50);
  const affordabilityRatio = availableMonthly / requiredMonthly;
  const feasibilityScore = clampScore(50 + (affordabilityRatio - 1) * 30, 20, 96);
  const riskLevel = feasibilityScore >= 70 ? "low" : feasibilityScore >= 45 ? "medium" : "high";

  return {
    monthlyIncome: income,
    monthlyExpenses: expenses,
    availableMonthly,
    targetAmount,
    monthsRemaining,
    availableLiquidSavings: liquidSavings,
    requiredMonthly,
    affordabilityRatio: Math.round(affordabilityRatio * 100) / 100,
    feasibilityScore,
    riskLevel,
  };
}

// Real check on the ACTUAL finalized plan: does its monthly_contribution,
// projected forward to the goal's real target_date and added to real liquid
// savings already on hand, actually reach the target amount? The AI's own
// monthly_contribution is never assumed sufficient just because it proposed
// it - same discipline as wedding's computeMilestoneFeasibility. Attached to
// the persisted confirmed_savings_plan artifact so it survives a reload,
// unlike computeGoalFeasibility above (which is always recomputed fresh).
export function computeSavingsPlanFeasibility(confirmedPlan, { monthlyContribution, availableLiquidSavings = 0 }) {
  const targetAmount = numberValue(confirmedPlan.total_budget, 0);
  const monthsRemaining = monthCountUntil(confirmedPlan.target_date);
  const liquidSavings = Math.max(0, numberValue(availableLiquidSavings, 0));
  const projectedSaved = Math.round(liquidSavings + numberValue(monthlyContribution, 0) * monthsRemaining);
  const funded = projectedSaved >= targetAmount;

  return {
    targetAmount,
    monthsRemaining,
    projectedSaved,
    funded,
    shortfallAmount: funded ? 0 : Math.round(targetAmount - projectedSaved),
  };
}
