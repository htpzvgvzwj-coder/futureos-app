import { getCurrentUserId } from "../../../lib/auth.js";
import { guard } from "../../../lib/http-guards.js";
import {
  createCareInvite, acceptCareInvite, listCareInvites, revokeCareLink,
  listSupervisedByMe, listMySupervisors, assertActiveRole,
} from "../../../lib/care/link-store.js";
import { buildGuardianSnapshot } from "../../../lib/care/guardian-snapshot.js";
import { decideAuthRequest, setLinkAllowance } from "../../../lib/authorization/store.js";
import { recordAuditEvent } from "../../../lib/account-control/store.js";
import { createNudge, listNudges, resolveNudge, setSharedRange, deleteSharedRange, listSharedRanges } from "../../../lib/care/extras.js";
import { listTransitions, decideTransition, setBirthYear } from "../../../lib/care/transitions.js";
import { query } from "../../../lib/db.js";

export const runtime = "nodejs";

// GET /api/care                -> links, my open invites, my shared ranges +
//                                 age-transition proposals, and nudges sent to me
// GET /api/care?account=<id>   -> the scope-limited snapshot of an account I look after
export async function GET(request) {
  const me = await getCurrentUserId(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const account = new URL(request.url).searchParams.get("account");

  try {
    if (account) {
      const role = await assertActiveRole(me, account, "view");
      if (!role) return Response.json({ error: "not_linked" }, { status: 403 });
      const [snapshot, nudges, sharedRanges] = await Promise.all([
        buildGuardianSnapshot(account, role.scope),
        listNudges(me, account),
        role.role === "household_member" ? listSharedRanges(account) : Promise.resolve([]),
      ]);
      await recordAuditEvent(null, account, { kind: "care_view_read", detail: { scope: role.scope }, actorKey: me });
      return Response.json({ account, role, snapshot, nudges, sharedRanges });
    }
    const [supervised, supervisors, invites, sharedRanges, transitions, byRow] = await Promise.all([
      listSupervisedByMe(me),
      listMySupervisors(me),
      listCareInvites(me),
      listSharedRanges(me),
      listTransitions(me),
      query(`select birth_year from user_onboarding where profile_key = $1`, [me]),
    ]);
    const birthYear = byRow.rows[0]?.birth_year ?? null;
    // every open nudge addressed to me, across the people I look after
    const inbox = [];
    for (const p of supervised) {
      const ns = await listNudges(me, p.ownerKey);
      for (const n of ns) inbox.push({ ...n, ownerKey: p.ownerKey, ownerLabel: p.ownerLabel });
    }
    return Response.json({ supervised, supervisors, invites, sharedRanges, transitions, birthYear, inbox });
  } catch (error) {
    console.error("[care] GET failed:", error?.message);
    return Response.json({ error: "care_unavailable" }, { status: 500 });
  }
}

// POST /api/care
//   { action: "invite" | "accept" | "revoke" | "set_allowance" | "decide" }   (Rounds 3-5)
//   { action: "nudge", roleId, title?, detail? }        -> owner: ask a linked person to look
//   { action: "nudge_done", account, id }               -> that person: mark it handled
//   { action: "set_range", category, low, high, note? } / { action: "delete_range", category }
//   { action: "set_birth_year", year }                  -> owner: drive age-transition proposals
//   { action: "transition", id, apply }                 -> owner: apply / dismiss a proposal
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
    if (body.action === "set_allowance") {
      if (!body.roleId) return Response.json({ error: "roleId_required" }, { status: 400 });
      const res = await setLinkAllowance(me, body.roleId, body.weekly);
      if (!res) return Response.json({ error: "link_not_found" }, { status: 404 });
      return Response.json({ allowance: res });
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
    if (body.action === "nudge") {
      // owner asks one linked person (identified by the supervisor link's roleId) to look
      if (!body.roleId) return Response.json({ error: "roleId_required" }, { status: 400 });
      const lr = await query(
        `select id, subject_key from lifecycle_roles where id = $1 and profile_key = $2 and status = 'active' and subject_key is not null`,
        [body.roleId, me],
      );
      if (!lr.rows[0]) return Response.json({ error: "link_not_found" }, { status: 404 });
      const n = await createNudge(me, { roleId: body.roleId, subjectKey: lr.rows[0].subject_key, title: body.title, detail: body.detail ?? null, ref: body.ref ?? {} });
      return Response.json({ nudge: n });
    }
    if (body.action === "nudge_done") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      return Response.json({ done: await resolveNudge(me, body.id) });
    }
    if (body.action === "set_range") {
      const r = await setSharedRange(me, { category: body.category, low: body.low, high: body.high, note: body.note ?? null });
      return Response.json({ range: r });
    }
    if (body.action === "delete_range") {
      return Response.json({ deleted: await deleteSharedRange(me, body.category) });
    }
    if (body.action === "set_birth_year") {
      return Response.json({ birthYear: await setBirthYear(me, body.year) });
    }
    if (body.action === "transition") {
      if (!body.id) return Response.json({ error: "id_required" }, { status: 400 });
      const res = await decideTransition(me, body.id, Boolean(body.apply));
      if (!res) return Response.json({ error: "transition_not_found" }, { status: 404 });
      return Response.json({ transition: res });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
