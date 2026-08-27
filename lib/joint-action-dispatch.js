// Registry for what actually runs once a joint action (lib/joint-action-
// store.js) is confirmed by the target. Replaces the previous ad-hoc setup
// (app/api/joint-actions/[id]/confirm/route.js used to hardcode a single
// unconditional call to applyGoalPause, and both that route and
// app/api/joint-actions/route.js independently redeclared their own
// DISPATCHABLE_ACTIONS Set) with one real action_type -> dispatcher map,
// single-sourced here.

import { applyGoalPause } from "./hardship-actions.js";
import { getOrCreateSession as getHardshipSession } from "./hardship-store.js";
import { applyGoalPlanJointConfirm } from "./goal-plan-actions.js";

async function dispatchGoalPause(action) {
  const hardshipSession = await getHardshipSession(action.target_user_id);
  return applyGoalPause({
    domain: action.domain,
    hardshipSessionId: hardshipSession.id,
    newMonthlyContribution: action.payload.newMonthlyContribution,
    explanation: action.payload.explanation,
    profileKey: action.target_user_id,
    decisionType: "approve",
    decisionReason: `Jointly proposed and confirmed by both parties (joint_action ${action.id})`,
    proposedAmount: action.payload.newMonthlyContribution,
  });
}

// Unlike dispatchGoalPause (target already owns the pre-existing plan being
// adjusted), a plan confirm writes the FIRST confirmed artifact for
// whichever partner actually submitted it from that domain's planner UI -
// the initiator, not the target. The target here is only the partner whose
// separate approval was required (see each domain's stage1/stage2 route's
// findActGrantor gate) - their own session for that domain is never touched.
function dispatchGoalPlanConfirm(domain) {
  return async function dispatch(action) {
    return applyGoalPlanJointConfirm(domain, action.payload, { profileKey: action.initiator_user_id });
  };
}

export const JOINT_ACTION_DISPATCHERS = {
  pause_goal_plan: dispatchGoalPause,
  reduce_goal_plan: dispatchGoalPause,
  confirm_wedding_plan: dispatchGoalPlanConfirm("wedding"),
  confirm_home_plan: dispatchGoalPlanConfirm("home"),
  confirm_retirement_plan: dispatchGoalPlanConfirm("retirement"),
  confirm_other_plan: dispatchGoalPlanConfirm("other"),
  confirm_travel_plan: dispatchGoalPlanConfirm("travel"),
};

export const DISPATCHABLE_ACTIONS = new Set(Object.keys(JOINT_ACTION_DISPATCHERS));
