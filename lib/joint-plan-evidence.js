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
import { getStrategicBalanceSnapshot } from "./strategic-balance-context.js";
import { getPreferences } from "./preferences-store.js";
import { resolveAssetPromptContext } from "./liquid-savings-context.js";

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

// Real feasibility check for a pause/reduce_goal_plan joint action
// (app/api/joint-actions/route.js) - the initiator types in a claimed
// newMonthlyContribution and an explanation, but that claim was never
// checked against anything real before this. Computed from the TARGET's
// OWN real stored profile and Asset Profile ledger (never the initiator's
// claim about the target's finances - same discipline as lib/joint-debate-
// context.js's getPartnerFeasibilityView), so it's a real check
// independent of what the initiator can see or asserts.
//
// The domain being paused/reduced is already one of the target's
// confirmed commitments - its OLD monthly contribution is netted out of
// committedMonthlyTotal before adding the newly claimed one, same
// "otherGoalsMonthlyOutflow" convention lib/cross-goal-context.js's own
// loan/investment impact math already uses, so this doesn't double-count
// the very commitment being changed.
export async function computeGoalPauseFeasibilityCheck(targetUserId, { domain, newMonthlyContribution }) {
  const targetPrefs = await getPreferences(targetUserId);
  const targetProfile = targetPrefs?.profile;
  if (!targetProfile || targetProfile.statedMonthlyIncome == null) return null;

  const monthlyIncome = Number(targetProfile.statedMonthlyIncome);
  const monthlyExpenses = Number(targetProfile.monthlyExpenses ?? 0);
  const availableMonthly = Math.max(monthlyIncome - monthlyExpenses, 100);

  const [{ committedMonthlyTotal }, balanceSnapshot, assetContext] = await Promise.all([
    getCrossGoalSnapshot(targetUserId),
    getStrategicBalanceSnapshot(targetUserId),
    resolveAssetPromptContext(targetUserId, targetProfile.currentSavings, monthlyExpenses, "flexible"),
  ]);
  const oldMonthlyContribution = balanceSnapshot.savings.find((plan) => plan.domain === domain)?.monthlyContribution ?? 0;
  const otherCommitmentsMonthlyTotal = Math.max(0, committedMonthlyTotal - oldMonthlyContribution);

  const { affordabilityRatio, feasibilityScore, riskLevel } = computeAffordabilityScore(availableMonthly, newMonthlyContribution);
  const utilizationPercent =
    monthlyIncome > 0 ? Math.round(((otherCommitmentsMonthlyTotal + newMonthlyContribution) / monthlyIncome) * 100) : 0;

  return {
    monthlyIncome,
    monthlyExpenses,
    availableMonthly,
    oldMonthlyContribution: Math.round(oldMonthlyContribution),
    newMonthlyContribution,
    otherCommitmentsMonthlyTotal: Math.round(otherCommitmentsMonthlyTotal),
    availableLiquidSavings: assetContext.availableLiquidSavings,
    affordabilityRatio,
    feasibilityScore,
    riskLevel,
    utilizationPercent,
  };
}
