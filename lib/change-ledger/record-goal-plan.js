// DB-aware Change Ledger recording for the goal-planner domains. Called by
// both the direct-save stage2 routes and the joint dispatcher
// (lib/goal-plan-actions.js) so a savings-plan confirm produces the exact
// same ledger event whichever path created it. Never throws.

import { recordEventSafe } from "./store.js";
import { buildSavingsPlanConfirmedEvent, buildGoalPlanConfirmedEvent } from "./producers/goal-plan.js";
import { checkCrossGoalRisk } from "../cross-goal-context.js";

// priorMonthlyContribution: the confirmed_savings_plan amount that was in
// force before this confirm (caller reads it - it's already loaded on most
// of these routes). crossGoalInputs: { monthlyIncome, monthlyExpenses,
// currentSavings } - the same real figures the route passes to
// triggerCrossGoalCheck; used here to attach real recomputed cross-goal
// Future Scores to the event's impact_set.
export async function recordSavingsPlanConfirmed({
  profileKey,
  domain,
  monthlyContribution,
  priorMonthlyContribution = null,
  targetCompleteMonth = null,
  crossGoalInputs = null,
  isJoint = false,
  actor = "user",
}) {
  let crossGoalResult = null;
  if (crossGoalInputs && crossGoalInputs.monthlyIncome > 0) {
    try {
      crossGoalResult = await checkCrossGoalRisk(profileKey, crossGoalInputs);
    } catch {
      crossGoalResult = null; // an impact we can't compute is omitted, not guessed
    }
  }
  return recordEventSafe(
    buildSavingsPlanConfirmedEvent({
      profileKey,
      domain,
      actor,
      monthlyContribution: Number(monthlyContribution),
      priorMonthlyContribution: priorMonthlyContribution == null ? null : Number(priorMonthlyContribution),
      targetCompleteMonth,
      crossGoalResult,
      isJoint,
    }),
  );
}

export async function recordGoalPlanConfirmed({ profileKey, domain, data, priorData = null, actor = "user" }) {
  return recordEventSafe(
    buildGoalPlanConfirmedEvent({ profileKey, domain, actor, data, priorData }),
  );
}
