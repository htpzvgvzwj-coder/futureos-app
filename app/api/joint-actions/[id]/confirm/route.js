import { getCurrentUserId } from "../../../../../lib/auth.js";
import { getJointAction, markJointActionConfirmed } from "../../../../../lib/joint-action-store.js";
import { JOINT_ACTION_DISPATCHERS, DISPATCHABLE_ACTIONS } from "../../../../../lib/joint-action-dispatch.js";

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

  const confirmed = await markJointActionConfirmed(id, userId);
  if (!confirmed) return Response.json({ error: "not_found" }, { status: 404 });

  const dispatch = JOINT_ACTION_DISPATCHERS[action.action_type];
  const result = await dispatch(action);

  return Response.json({ confirmed: true, result });
}
