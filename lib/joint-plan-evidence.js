// Real evidence for a joint goal-plan confirmation (lib/goal-plan-actions.js)
// - what the confirming partner sees on /grants before they tap
// Confirm/Decline. Previously they only saw a one-line text summary
// (app/grants/page.jsx's describeJointAction) and had to confirm blind,
// without the same real feasibility/whole-picture evidence the initiator
// saw when they built the plan. Reuses the exact same real math Mirror
// already uses (lib/mirror-finance.js's computeAffordabilityScore,
// lib/cross-goal-context.js's whole-picture impact) rather than a second,
// potentially-diverging formula - "AI touches zero numbers" applies here
// too, this is pure arithmetic over real numbers already in scope at
// propose time.
import { computeAffordabilityScore } from "./mirror-finance.js";
import { getCrossGoalSnapshot, computeWholePictureImpact } from "./cross-goal-context.js";

export async function computeJointPlanEvidence(profileKey, { monthlyIncome, monthlyExpenses, availableLiquidSavings, monthlyContribution }) {
  const availableMonthly = Math.max(monthlyIncome - monthlyExpenses, 100);
  const { affordabilityRatio, feasibilityScore, riskLevel } = computeAffordabilityScore(availableMonthly, monthlyContribution);

  const crossGoalSnapshot = await getCrossGoalSnapshot(profileKey);
  const wholePicture = computeWholePictureImpact(
    { monthlyIncome, monthlyExpenses, availableMonthly, requiredMonthly: monthlyContribution, availableLiquidSavings },
    crossGoalSnapshot
  );

  return {
    monthlyIncome,
    monthlyExpenses,
    availableMonthly,
    requiredMonthly: monthlyContribution,
    affordabilityRatio,
    feasibilityScore,
    riskLevel,
    wholePicture,
  };
}
