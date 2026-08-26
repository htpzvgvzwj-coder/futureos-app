import { getCurrentUserId } from "../../../../../lib/auth.js";
import { getDebateForParty } from "../../../../../lib/mirror-store.js";

export const runtime = "nodejs";

// Real authorization, not a lookup by id alone: only the debate's real
// initiator (profile_key) or its real designated joint partner (partner_id -
// lib/joint-debate-context.js's getJointPartnerId, captured at generation
// time) can fetch it. This is what lets a partner who was notified
// (guardian_alerts, alertType "joint_debate_pending") actually load and
// read the debate they were told about.
export async function GET(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const debate = await getDebateForParty(id, userId);
  if (!debate) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({ debate });
}
