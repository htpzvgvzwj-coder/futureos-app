// Authorization / approval queue (Phase 6 Round 2).
//
// On a youth/child account - or when the owner sets an amount rule - a real
// money move (internal transfer, card repayment) becomes a PENDING
// authorization request instead of executing. A holder of an approve-scoped
// role decides it; on approve the move executes from the stored payload.
//
// Single-account for now: the queue lives on the owner's account. When a
// guardian is actually linked (a lifecycle_roles row with subject_key set,
// scope 'approve', status 'active') the decision is attributed to them;
// otherwise the account owner reviews it here. Every step is audited.

import { query } from "../db.js";
import { recordAuditEvent } from "../account-control/store.js";
import { recordInternalTransfer, recordCardRepayment } from "../transaction-ledger/store.js";
import { recordEventSafe } from "../change-ledger/store.js";
import { ACTION_TYPES } from "../change-ledger/events.js";

export const APPROVAL_KINDS = ["internal_transfer", "card_repayment"];
const DEFAULT_POLICY = { restrictedNeedApproval: true, approvalOverAmount: null };

// ---- policy -------------------------------------------------
export async function getAuthPolicy(profileKey) {
  const r = await query(`select * from authorization_policies where profile_key = $1`, [profileKey]);
  if (!r.rows[0]) return { ...DEFAULT_POLICY };
  return {
    restrictedNeedApproval: r.rows[0].restricted_need_approval,
    approvalOverAmount: r.rows[0].approval_over_amount == null ? null : Number(r.rows[0].approval_over_amount),
  };
}

export async function setAuthPolicy(profileKey, { restrictedNeedApproval, approvalOverAmount } = {}) {
  const cur = await getAuthPolicy(profileKey);
  const next = {
    restrictedNeedApproval: restrictedNeedApproval === undefined ? cur.restrictedNeedApproval : Boolean(restrictedNeedApproval),
    approvalOverAmount:
      approvalOverAmount === undefined
        ? cur.approvalOverAmount
        : approvalOverAmount == null || approvalOverAmount === "" || Number(approvalOverAmount) <= 0
          ? null
          : Math.round(Number(approvalOverAmount)),
  };
  await query(
    `insert into authorization_policies (profile_key, restricted_need_approval, approval_over_amount, updated_at)
     values ($1,$2,$3,now())
     on conflict (profile_key) do update set
       restricted_need_approval = excluded.restricted_need_approval,
       approval_over_amount = excluded.approval_over_amount,
       updated_at = now()`,
    [profileKey, next.restrictedNeedApproval, next.approvalOverAmount],
  );
  await recordAuditEvent(null, profileKey, { kind: "authorization_policy_changed", detail: next });
  return next;
}

// ---- pure decision rule (no DB - unit-testable) -------------
// A restricted account is youth or guardian-managed child. A money move on
// such an account needs approval when restrictedNeedApproval is on. On any
// account, a move strictly above approvalOverAmount needs approval.
export function evaluateAuthorization({ accountType, policy = DEFAULT_POLICY, kind, amount }) {
  if (!APPROVAL_KINDS.includes(kind)) return { required: false, reason: null };
  const amt = Number(amount) || 0;
  const restricted = accountType === "youth" || accountType === "guardian_managed_child";
  if (restricted && policy.restrictedNeedApproval) {
    return { required: true, reason: "This account is supervised — a guardian approves money moves." };
  }
  if (policy.approvalOverAmount != null && amt > policy.approvalOverAmount) {
    return {
      required: true,
      reason: `You asked to check any move over ${policy.currency ?? "SGD"} ${policy.approvalOverAmount.toLocaleString("en-SG")}.`,
    };
  }
  return { required: false, reason: null };
}

// ---- requests ---------------------------------------------
function mapRequest(r) {
  return {
    id: r.id,
    kind: r.kind,
    summary: r.summary,
    amount: r.amount == null ? null : Number(r.amount),
    currency: r.currency,
    reason: r.reason ?? null,
    status: r.status,
    decidedBy: r.decided_by ?? null,
    decidedByRoleId: r.decided_by_role_id ?? null,
    decisionNote: r.decision_note ?? null,
    createdAt: r.created_at,
    decidedAt: r.decided_at ?? null,
    executedAt: r.executed_at ?? null,
    expiresAt: r.expires_at,
  };
}

// Returns an existing pending/approved request for this idempotency key if
// one is already on file (so a retried pay call doesn't stack duplicates).
export async function findRequestByIdempotency(profileKey, idempotencyKey) {
  if (!idempotencyKey) return null;
  const r = await query(
    `select * from authorization_requests
      where profile_key = $1 and payload->>'idempotencyKey' = $2
      order by created_at desc limit 1`,
    [profileKey, idempotencyKey],
  );
  return r.rows[0] ? mapRequest(r.rows[0]) : null;
}

export async function createAuthRequest(profileKey, { kind, summary, amount, currency = "SGD", payload = {}, reason = null }) {
  if (!APPROVAL_KINDS.includes(kind)) throw new Error(`invalid approval kind: ${kind}`);
  const r = await query(
    `insert into authorization_requests (profile_key, kind, summary, amount, currency, payload, reason)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [profileKey, kind, summary, amount == null ? null : Math.round(Number(amount)), currency, JSON.stringify(payload), reason],
  );
  await recordAuditEvent(null, profileKey, { kind: "authorization_requested", detail: { kind, amount, reason } });
  return mapRequest(r.rows[0]);
}

export async function listAuthRequests(profileKey, { status = null } = {}) {
  const vals = [profileKey];
  let where = `profile_key = $1`;
  if (status) {
    vals.push(status);
    where += ` and status = $2`;
  }
  const r = await query(`select * from authorization_requests where ${where} order by created_at desc limit 100`, vals);
  return r.rows.map(mapRequest);
}

export async function countPendingAuthRequests(profileKey) {
  const r = await query(
    `select count(*)::int as n from authorization_requests where profile_key = $1 and status = 'pending' and expires_at > now()`,
    [profileKey],
  );
  return r.rows[0]?.n ?? 0;
}

// Is a real guardian linked to this account (so a decision here is theirs)?
export async function hasLinkedApprover(profileKey) {
  const r = await query(
    `select 1 from lifecycle_roles
      where profile_key = $1 and scope = 'approve' and status = 'active' and subject_key is not null limit 1`,
    [profileKey],
  );
  return r.rows.length > 0;
}

// Approve or decline. On approve of a money move, execute it from the
// stored payload, mark executed and write a Change Ledger event.
export async function decideAuthRequest(profileKey, id, { decision, note = null, decidedBy = "owner", roleId = null } = {}) {
  if (decision !== "approved" && decision !== "declined") throw new Error("decision must be 'approved' or 'declined'");
  const cur = await query(`select * from authorization_requests where id = $1 and profile_key = $2`, [id, profileKey]);
  const row = cur.rows[0];
  if (!row) return null;
  if (row.status !== "pending") return { ...mapRequest(row), unchanged: true };

  const upd = await query(
    `update authorization_requests set status = $3, decided_by = $4, decided_by_role_id = $5, decision_note = $6, decided_at = now()
      where id = $1 and profile_key = $2 and status = 'pending' returning *`,
    [id, profileKey, decision, decidedBy, roleId, note],
  );
  let out = mapRequest(upd.rows[0]);
  await recordAuditEvent(null, profileKey, { kind: `authorization_${decision}`, detail: { id, decidedBy, note } });

  if (decision === "approved") {
    const p = typeof row.payload === "string" ? JSON.parse(row.payload || "{}") : row.payload || {};
    try {
      if (row.kind === "internal_transfer") {
        await recordInternalTransfer(profileKey, {
          fromAccountId: p.fromAccountId,
          toAccountId: p.toAccountId,
          amount: p.amount,
          currency: p.currency ?? "SGD",
          idempotencyKey: p.idempotencyKey,
        });
      } else if (row.kind === "card_repayment") {
        await recordCardRepayment(profileKey, {
          fromAccountId: p.fromAccountId,
          cardAccountId: p.cardAccountId,
          amount: p.amount,
          currency: p.currency ?? "SGD",
          idempotencyKey: p.idempotencyKey,
        });
      }
      const done = await query(
        `update authorization_requests set status = 'executed', executed_at = now() where id = $1 and profile_key = $2 returning *`,
        [id, profileKey],
      );
      out = mapRequest(done.rows[0]);
      const amt = Number(row.amount) || 0;
      await recordEventSafe({
        profileKey,
        actor: decidedBy === "guardian" ? "guardian" : "user",
        sourceFeature: "guardian",
        actionType: ACTION_TYPES.GUARDIAN_ACTION,
        status: "completed",
        messageKey: "ledger.authorizationApproved",
        messageParams: { amount: amt, kind: row.kind },
        cause: { trigger: "authorization_approved", requestId: id, decidedBy },
        afterSnapshot: { amount: amt, kind: row.kind },
        dedupeKey: `authorization:${id}:executed`,
      }).catch(() => {});
    } catch (err) {
      const failed = await query(
        `update authorization_requests set decision_note = $3 where id = $1 and profile_key = $2 returning *`,
        [id, profileKey, `approved but could not execute: ${err.message}`],
      );
      out = { ...mapRequest(failed.rows[0]), executionError: err.message };
    }
  }
  return out;
}

export async function cancelAuthRequest(profileKey, id) {
  const r = await query(
    `update authorization_requests set status = 'cancelled', decided_at = now()
      where id = $1 and profile_key = $2 and status = 'pending' returning id`,
    [id, profileKey],
  );
  return r.rows.length > 0;
}
