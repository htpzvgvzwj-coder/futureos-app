import { getCurrentUserId } from "../../../lib/auth.js";
import { guard } from "../../../lib/http-guards.js";
import {
  createCareInvite, acceptCareInvite, listCareInvites, revokeCareLink,
  listSupervisedByMe, listMySupervisors, assertActiveRole,
} from "../../../lib/care/link-store.js";
import { buildGuardianSnapshot } from "../../../lib/care/guardian-snapshot.js";
import { decideAuthRequest } from "../../../lib/authorization/store.js";
import { recordAuditEvent } from "../../../lib/account-control/store.js";

export const runtime = "nodejs";

// GET /api/care                -> who I look after, who looks after me, my open invites
// GET /api/care?account=<id>   -> the scope-limited snapshot of an account I look after
export async function GET(request) {
  const me = await getCurrentUserId(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const account = new URL(request.url).searchParams.get("account");

  try {
    if (account) {
      const role = await assertActiveRole(me, account, "view");
      if (!role) return Response.json({ error: "not_linked" }, { status: 403 });
      const snapshot = await buildGuardianSnapshot(account, role.scope);
      await recordAuditEvent(null, account, { kind: "care_view_read", detail: { scope: role.scope }, actorKey: me });
      return Response.json({ account, role, snapshot });
    }
    const [supervised, supervisors, invites] = await Promise.all([
      listSupervisedByMe(me),
      listMySupervisors(me),
      listCareInvites(me),
    ]);
    return Response.json({ supervised, supervisors, invites });
  } catch (error) {
    console.error("[care] GET failed:", error?.message);
    return Response.json({ error: "care_unavailable" }, { status: 500 });
  }
}

// POST /api/care
//   { action: "invite", roleId }              -> owner: one-time code for a pending role
//   { action: "accept", code }                -> invitee: link my account to the owner's
//   { action: "revoke", roleId }              -> either party: sever the link
//   { action: "decide", account, id, decision, note? } -> approver: decide the owner's queue
export async function POST(request) {
  const me = await getCurrentUserId(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "care", limit: 30 });
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "invite") {
      if (!body.roleId) return Response.json({ error: "roleId_required" }, { status: 400 });
      const { invite, code } = await createCareInvite(me, { roleId: body.roleId });
      return Response.json({ invite, code, note: "Share this code once. It expires in 14 days and can be used a single time." });
    }
    if (body.action === "accept") {
      const linked = await acceptCareInvite(me, String(body.code || "").trim().toUpperCase());
      return Response.json({ linked });
    }
    if (body.action === "revoke") {
      if (!body.roleId) return Response.json({ error: "roleId_required" }, { status: 400 });
      return Response.json({ revoked: await revokeCareLink(me, { roleId: body.roleId }) });
    }
    if (body.action === "decide") {
      if (!body.account || !body.id) return Response.json({ error: "account_and_id_required" }, { status: 400 });
      const role = await assertActiveRole(me, body.account, "approve");
      if (!role) return Response.json({ error: "not_authorised_to_approve" }, { status: 403 });
      const result = await decideAuthRequest(body.account, body.id, {
        decision: body.decision,
        note: body.note ?? null,
        decidedBy: "guardian",
        roleId: role.roleId,
      });
      if (!result) return Response.json({ error: "request_not_found" }, { status: 404 });
      await recordAuditEvent(null, body.account, { kind: `care_decided_${body.decision}`, detail: { requestId: body.id }, actorKey: me });
      return Response.json({ request: result });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
