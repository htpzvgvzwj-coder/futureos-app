import { getCurrentUserId, getUserById } from "../../../../../lib/auth.js";
import { getJointAction, markJointActionConfirmed } from "../../../../../lib/joint-action-store.js";
import { JOINT_ACTION_DISPATCHERS, DISPATCHABLE_ACTIONS } from "../../../../../lib/joint-action-dispatch.js";
import { createAlert } from "../../../../../lib/guardian-alert-store.js";

export const runtime = "nodejs";

// The second, independent confirmation a joint action needs before it actually
// executes - only the target (whose data this affects) can call this, and only
// once. Dispatches via the shared registry (lib/joint-action-dispatch.js),
// which always acts on the TARGET's own data, never the initiator's - a
// joint action always acts on whoever it was proposed against.
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

  // Dispatch BEFORE marking confirmed - a failed dispatch (e.g. the target's
  // own precondition for this domain isn't actually met) must never leave
  // the record saying "confirmed" when nothing real happened. Found via live
  // verification while building initiator visibility below: the previous
  // mark-then-dispatch order meant a dispatch failure still left status =
  // 'confirmed' in the DB, which the initiator would now see as a real
  // (but false) confirmation.
  const dispatch = JOINT_ACTION_DISPATCHERS[action.action_type];
  const result = await dispatch(action);

  const confirmed = await markJointActionConfirmed(id, userId);
  if (!confirmed) return Response.json({ error: "not_found" }, { status: 404 });

  // Real notification to the initiator - previously a confirm (and the
  // real dispatched change it caused) was invisible to them too. Non-fatal:
  // a bug here must never fail the confirm/dispatch that already succeeded.
  try {
    const confirmer = await getUserById(userId);
    await createAlert(action.initiator_user_id, {
      alertType: "joint_action_resolved",
      domain: action.domain,
      severity: "monitoring",
      detail: {
        jointActionId: action.id,
        actionType: action.action_type,
        outcome: "confirmed",
        targetDisplayName: confirmer?.display_name ?? null,
      },
    });
  } catch (error) {
    console.error("joint-actions/confirm: failed to notify initiator (non-fatal)", error);
  }

  return Response.json({ confirmed: true, result });
}
