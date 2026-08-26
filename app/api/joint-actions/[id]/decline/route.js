import { getCurrentUserId, getUserById } from "../../../../../lib/auth.js";
import { declineJointAction } from "../../../../../lib/joint-action-store.js";
import { createAlert } from "../../../../../lib/guardian-alert-store.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  let reason = null;
  try {
    const body = await request.json();
    if (typeof body?.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch {
    // No body sent - reason stays null, decline still proceeds. Never required.
  }

  const declined = await declineJointAction(id, userId, reason);
  if (!declined) return Response.json({ error: "not_found" }, { status: 404 });

  // Real notification to the initiator - previously a decline vanished into
  // silence with no way for them to ever find out. Non-fatal: a bug here
  // must never fail the decline itself.
  try {
    const decliner = await getUserById(userId);
    await createAlert(declined.initiator_user_id, {
      alertType: "joint_action_resolved",
      domain: declined.domain,
      severity: "monitoring",
      detail: {
        jointActionId: declined.id,
        actionType: declined.action_type,
        outcome: "declined",
        declineReason: reason,
        targetDisplayName: decliner?.display_name ?? null,
      },
    });
  } catch (error) {
    console.error("joint-actions/decline: failed to notify initiator (non-fatal)", error);
  }

  return Response.json({ action: declined });
}
