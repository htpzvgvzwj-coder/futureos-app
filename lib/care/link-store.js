// Phase 6 Round 3 - real cross-user linking for Care.
//
// An account owner creates a one-time invite for a placeholder role. A
// second, already-registered person accepts it with the code; that fills
// lifecycle_roles.subject_key with their users.id and flips the row to
// 'active'. From then on that person can read a scope-limited view of the
// owner's account (never the raw ledger unless the account is a
// guardian-managed child) and, with 'approve' scope, decide the owner's
// authorization queue.
//
// Invariants enforced here (not in the route):
//   - only the sha256 of the code is stored; the code is shown once
//   - you cannot accept your own invite
//   - an expired / revoked / already-accepted invite cannot be accepted
//   - either party can revoke; revoke is immediate and total
//   - assertActiveRole is the single gate every cross-account read/write
//     must pass

import crypto from "node:crypto";
import { query } from "../db.js";
import { recordAuditEvent } from "../account-control/store.js";

const LINKABLE_ROLES = ["guardian", "trusted_contact", "household_member", "dependent"];
const LINKABLE_SCOPES = ["view", "suggest", "approve"];

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
// human-friendly one-time code: 3 groups of 4 from an unambiguous alphabet
function newCode() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => alpha[crypto.randomInt(alpha.length)];
  return [0, 1, 2].map(() => Array.from({ length: 4 }, pick).join("")).join("-");
}

function mapInvite(r) {
  return {
    id: r.id,
    roleId: r.role_id,
    role: r.role,
    scope: r.scope,
    status: r.status,
    acceptedBy: r.accepted_by ?? null,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at ?? null,
    expiresAt: r.expires_at,
  };
}

// Create an invite for an existing pending placeholder role on the owner's
// account. Returns { invite, code } - the code is returned ONCE and never
// again.
export async function createCareInvite(profileKey, { roleId }) {
  const roleRes = await query(
    `select * from lifecycle_roles where id = $1 and profile_key = $2 and status = 'pending'`,
    [roleId, profileKey],
  );
  const role = roleRes.rows[0];
  if (!role) throw new Error("no pending role to invite for");
  if (!LINKABLE_ROLES.includes(role.role)) throw new Error(`role ${role.role} cannot be linked to a person`);
  if (!LINKABLE_SCOPES.includes(role.scope)) throw new Error(`scope ${role.scope} cannot be linked`);

  // supersede any earlier open invite for this same role
  await query(`update care_invites set status = 'revoked' where role_id = $1 and status = 'open'`, [roleId]);

  const code = newCode();
  const res = await query(
    `insert into care_invites (profile_key, role_id, role, scope, code_hash)
     values ($1,$2,$3,$4,$5) returning *`,
    [profileKey, roleId, role.role, role.scope, sha256(code)],
  );
  await recordAuditEvent(null, profileKey, { kind: "care_invite_created", detail: { roleId, role: role.role, scope: role.scope } });
  return { invite: mapInvite(res.rows[0]), code };
}

// Accept an invite as `accepterKey` (a users.id, from their own session).
export async function acceptCareInvite(accepterKey, code) {
  if (!code) throw new Error("code required");
  const res = await query(`select * from care_invites where code_hash = $1`, [sha256(code)]);
  const inv = res.rows[0];
  if (!inv) throw new Error("that code is not valid");
  if (inv.status !== "open") throw new Error(`this invite is ${inv.status}`);
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    await query(`update care_invites set status = 'expired' where id = $1`, [inv.id]);
    throw new Error("this invite has expired");
  }
  if (inv.profile_key === accepterKey) throw new Error("you cannot accept your own invite");

  // fill the placeholder role with the real person + activate it
  const roleRes = await query(
    `update lifecycle_roles set subject_key = $1, status = 'active', updated_at = now()
      where id = $2 and profile_key = $3 and status = 'pending' returning *`,
    [accepterKey, inv.role_id, inv.profile_key],
  );
  if (!roleRes.rows[0]) throw new Error("the role for this invite is no longer available");

  await query(`update care_invites set status = 'accepted', accepted_by = $1, accepted_at = now() where id = $2`, [accepterKey, inv.id]);
  await recordAuditEvent(null, inv.profile_key, { kind: "care_invite_accepted", detail: { roleId: inv.role_id, role: inv.role, scope: inv.scope }, actorKey: accepterKey });
  await recordAuditEvent(null, accepterKey, { kind: "care_link_joined", detail: { ownerKey: inv.profile_key, role: inv.role, scope: inv.scope }, actorKey: accepterKey });
  return { ownerKey: inv.profile_key, role: inv.role, scope: inv.scope };
}

export async function listCareInvites(profileKey) {
  const res = await query(`select * from care_invites where profile_key = $1 order by created_at desc limit 50`, [profileKey]);
  return res.rows.map(mapInvite);
}

// Either party (owner or the linked person) can sever the link. Revokes the
// role and closes any open invite for it.
export async function revokeCareLink(callerKey, { roleId }) {
  const res = await query(
    `select * from lifecycle_roles where id = $1 and status <> 'revoked' and (profile_key = $2 or subject_key = $2)`,
    [roleId, callerKey],
  );
  const role = res.rows[0];
  if (!role) return false;
  await query(`update lifecycle_roles set status = 'revoked', revoked_at = now() where id = $1`, [roleId]);
  await query(`update care_invites set status = 'revoked' where role_id = $1 and status = 'open'`, [roleId]);
  await recordAuditEvent(null, role.profile_key, { kind: "care_link_revoked", detail: { roleId, by: callerKey === role.profile_key ? "owner" : "linked_person" }, actorKey: callerKey });
  return true;
}

// Accounts THIS user can see (their active roles on other people's data).
export async function listSupervisedByMe(subjectKey) {
  const res = await query(
    `select lr.*, u.display_name as owner_name, u.email as owner_email
       from lifecycle_roles lr join users u on u.id::text = lr.profile_key
      where lr.subject_key = $1 and lr.status = 'active'
      order by lr.created_at asc`,
    [subjectKey],
  );
  return res.rows.map((r) => ({
    roleId: r.id,
    ownerKey: r.profile_key,
    ownerLabel: r.owner_name || String(r.owner_email || "").split("@")[0] || "Someone",
    role: r.role,
    scope: r.scope,
    autoApproveWeekly: r.auto_approve_weekly == null ? null : Number(r.auto_approve_weekly),
    since: r.created_at,
  }));
}

// People who can see THIS user's account (transparency for the owner).
export async function listMySupervisors(profileKey) {
  const res = await query(
    `select lr.*, u.display_name as person_name, u.email as person_email
       from lifecycle_roles lr join users u on u.id::text = lr.subject_key
      where lr.profile_key = $1 and lr.status = 'active' and lr.subject_key is not null
      order by lr.created_at asc`,
    [profileKey],
  );
  return res.rows.map((r) => ({
    roleId: r.id,
    personKey: r.subject_key,
    personLabel: r.person_name || String(r.person_email || "").split("@")[0] || "Someone",
    role: r.role,
    scope: r.scope,
    autoApproveWeekly: r.auto_approve_weekly == null ? null : Number(r.auto_approve_weekly),
    since: r.created_at,
  }));
}

// THE gate. Returns the active role row if `callerKey` may act on
// `ownerKey`'s account at `minScope` or higher, else null. Every
// cross-account read/write in the API must call this first.
const SCOPE_RANK = { view: 1, suggest: 2, approve: 3, manage: 4 };
export async function assertActiveRole(callerKey, ownerKey, minScope = "view") {
  if (!callerKey || !ownerKey) return null;
  const res = await query(
    `select * from lifecycle_roles where profile_key = $1 and subject_key = $2 and status = 'active'`,
    [ownerKey, callerKey],
  );
  const need = SCOPE_RANK[minScope] ?? 99;
  const role = res.rows.find((r) => (SCOPE_RANK[r.scope] ?? 0) >= need);
  if (!role) return null;
  return { roleId: role.id, role: role.role, scope: role.scope };
}
