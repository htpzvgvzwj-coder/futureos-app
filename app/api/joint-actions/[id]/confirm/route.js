import { getCurrentUserId } from "../../../../../lib/auth.js";
import { getJointAction, markJointActionConfirmed } from "../../../../../lib/joint-action-store.js";
import { applyGoalPause } from "../../../../../lib/hardship-actions.js";
import { getOrCreateSession as getHardshipSession } from "../../../../../lib/hardship-store.js";

export const runtime = "nodejs";

const DISPATCHABLE_ACTIONS = new Set(["pause_goal_plan", "reduce_goal_plan"]);

// The second, independent confirmation a joint action needs before it actually
// executes - only the target (whose data this affects) can call this, and only
// once. Dispatches against the TARGET's own hardship session, never the
// initiator's - a joint action always acts on whoever it was proposed against.
export async function POST(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const action = await getJointAction(id);
  if (!action || action.target_user_id !== userId || action.status !== "pending") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (!DISPATCHABLE_ACTIONS.has(action.action_type)) {
    return Response.json({ error: "not_yet_dispatchable" }, { status: 400 });
  }

  const confirmed = await markJointActionConfirmed(id, userId);
  if (!confirmed) return Response.json({ error: "not_found" }, { status: 404 });

  const hardshipSession = await getHardshipSession(action.target_user_id);
  const result = await applyGoalPause({
    domain: action.domain,
    hardshipSessionId: hardshipSession.id,
    newMonthlyContribution: action.payload.newMonthlyContribution,
    explanation: action.payload.explanation,
    profileKey: action.target_user_id,
    decisionType: "approve",
    decisionReason: `Jointly proposed and confirmed by both parties (joint_action ${action.id})`,
    proposedAmount: action.payload.newMonthlyContribution,
  });

  return Response.json({ confirmed: true, result });
}
