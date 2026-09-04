// Authorization / approval queue (Phase 6 Rounds 2 & 5).
//
// A real money move (internal transfer, card repayment) can be parked as a
// PENDING request instead of executing, when the account's rules say so.
// How a parked move resolves depends on the policy mode:
//
//   approval     - a holder of an approve-scoped role decides it
//   cooling_off  - it runs itself after `coolingOffHours` unless someone stops
//                  it first (elderly self-protection: no one has to be online)
//
// Extra rules:
//   require_both        - an approve is not enough; the owner must also confirm
//   auto_approve_weekly - the owner delegates a small weekly ceiling to one
//                         guardian; moves within it are auto-approved
//   decline needs a note - a rejection always carries a reason for the owner
//
// The move executes from the stored payload. Every step is audited + in the
// Change Ledger.

import { query } from "../db.js";
import { recordAuditEvent } from "../account-control/store.js";
import { recordInternalTransfer, recordCardRepayment } from "../transaction-ledger/store.js";
import { recordEventSafe } from "../change-ledger/store.js";
import { ACTION_TYPES } from "../change-ledger/events.js";

export const APPROVAL_KINDS = ["internal_transfer", "card_repayment"];
export const POLICY_MODES = ["approval", "cooling_off"];
const DEFAULT_POLICY = {
  restrictedNeedApproval: true,
  approvalOverAmount: null,
  mode: "approval",
  coolingOffHours: 48,
  requireBoth: false,
};

// ---- policy -------------------------------------------------
export async function getAuthPolicy(profileKey) {
  const r = await query(`select * from authorization_policies where profile_key = $1`, [profileKey]);
  if (!r.rows[0]) return { ...DEFAULT_POLICY };
  const row = r.rows[0];
  return {
    restrictedNeedApproval: row.restricted_need_approval,
    approvalOverAmount: row.approval_over_amount == null ? null : Number(row.approval_over_amount),
    mode: POLICY_MODES.includes(row.mode) ? row.mode : "approval",
    coolingOffHours: row.cooling_off_hours ?? 48,
    requireBoth: Boolean(row.require_both),
  };
}

export async function setAuthPolicy(profileKey, patch = {}) {
  const cur = await getAuthPolicy(profileKey);
  const pick = (k, coerce, fallback) => (patch[k] === undefined ? cur[k] : coerce(patch[k], fallback));
  const next = {
    restrictedNeedApproval: pick("restrictedNeedApproval", (v) => Boolean(v)),
    approvalOverAmount: pick("approvalOverAmount", (v) =>
      v == null || v === "" || Number(v) <= 0 ? null : Math.round(Number(v)),
    ),
    mode: pick("mode", (v) => (POLICY_MODES.includes(v) ? v : "approval")),
    coolingOffHours: pick("coolingOffHours", (v) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(168, Math.max(1, n)) : 48;
    }),
    requireBoth: pick("requireBoth", (v) => Boolean(v)),
  };
  await query(
    `insert into authorization_policies
       (profile_key, restricted_need_approval, approval_over_amount, mode, cooling_off_hours, require_both, updated_at)
     values ($1,$2,$3,$4,$5,$6,now())
     on conflict (profile_key) do update set
       restricted_need_approval = excluded.restricted_need_approval,
       approval_over_amount = excluded.approval_over_amount,
       mode = excluded.mode,
       cooling_off_hours = excluded.cooling_off_hours,
       require_both = excluded.require_both,
       updated_at = now()`,
    [profileKey, next.restrictedNeedApproval, next.approvalOverAmount, next.mode, next.coolingOffHours, next.requireBoth],
  );
  await recordAuditEvent(null, profileKey, { kind: "authorization_policy_changed", detail: next });
  return next;
}

// ---- pure decision rule (no DB - unit-testable) -------------
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
    autoReason: r.auto_reason ?? null,
    autoExecuteAt: r.auto_execute_at ?? null,
    ownerConfirmedAt: r.owner_confirmed_at ?? null,
    covers: r.covers ?? null,
    createdAt: r.created_at,
    decidedAt: r.decided_at ?? null,
    executedAt: r.executed_at ?? null,
    expiresAt: r.expires_at,
  };
}

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

export async function createAuthRequest(
  profileKey,
  { kind, summary, amount, currency = "SGD", payload = {}, reason = null, covers = null },
) {
  if (!APPROVAL_KINDS.includes(kind)) throw new Error(`invalid approval kind: ${kind}`);
  const policy = await getAuthPolicy(profileKey);
  const autoExecuteAt =
    policy.mode === "cooling_off" ? new Date(Date.now() + policy.coolingOffHours * 3_600_000).toISOString() : null;
  const r = await query(
    `insert into authorization_requests (profile_key, kind, summary, amount, currency, payload, reason, covers, auto_execute_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [
      profileKey,
      kind,
      summary,
      amount == null ? null : Math.round(Number(amount)),
      currency,
      JSON.stringify(payload),
      reason,
      covers,
      autoExecuteAt,
    ],
  );
  await recordAuditEvent(null, profileKey, { kind: "authorization_requested", detail: { kind, amount, reason, mode: policy.mode } });

  // an owner-delegated weekly allowance can clear a small move immediately
  const auto = await tryAllowanceAutoApprove(profileKey, r.rows[0]);
  if (auto) return auto;
  return mapRequest(r.rows[0]);
}

// Sum of this-week's within-allowance auto-approvals, per account.
async function weeklyAllowanceUsed(profileKey) {
  const r = await query(
    `select coalesce(sum(amount),0)::numeric as used
       from authorization_requests
      where profile_key = $1 and auto_reason = 'within_allowance'
        and executed_at > now() - interval '7 days'`,
    [profileKey],
  );
  return Number(r.rows[0]?.used ?? 0);
}

// If the owner has delegated a weekly ceiling to a linked approver and this
// move fits under the remaining headroom, approve + execute it now.
async function tryAllowanceAutoApprove(profileKey, row) {
  const amt = Number(row.amount) || 0;
  if (amt <= 0) return null;
  const lr = await query(
    `select id, auto_approve_weekly from lifecycle_roles
      where profile_key = $1 and scope = 'approve' and status = 'active'
        and subject_key is not null and auto_approve_weekly is not null
      order by auto_approve_weekly desc limit 1`,
    [profileKey],
  );
  const link = lr.rows[0];
  if (!link) return null;
  const ceiling = Number(link.auto_approve_weekly);
  if (!(ceiling > 0)) return null;
  const used = await weeklyAllowanceUsed(profileKey);
  if (used + amt > ceiling) return null;

  const executed = await executeApproved(profileKey, row, {
    decidedBy: "auto",
    roleId: link.id,
    autoReason: "within_allowance",
    note: `Within the SGD ${ceiling.toLocaleString("en-SG")}/week the account owner delegated.`,
  });
  return executed;
}

export async function listAuthRequests(profileKey, { status = null } = {}) {
  await sweepDueRequests(profileKey); // cooling-off deadlines that have elapsed
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
  await sweepDueRequests(profileKey);
  const r = await query(
    `select count(*)::int as n from authorization_requests where profile_key = $1 and status = 'pending' and expires_at > now()`,
    [profileKey],
  );
  return r.rows[0]?.n ?? 0;
}

// Cooling-off: any pending request whose deadline has passed runs itself now
// (unless the two-person rule is on and the owner has not confirmed).
export async function sweepDueRequests(profileKey) {
  const due = await query(
    `select * from authorization_requests
      where profile_key = $1 and status = 'pending' and auto_execute_at is not null and auto_execute_at <= now()`,
    [profileKey],
  );
  if (due.rows.length === 0) return 0;
  const policy = await getAuthPolicy(profileKey);
  let ran = 0;
  for (const row of due.rows) {
    if (policy.requireBoth && !row.owner_confirmed_at) continue; // still needs the owner's half
    await executeApproved(profileKey, row, { decidedBy: "auto", autoReason: "cooling_off_elapsed", note: "Ran automatically after the cooling-off window; not stopped." });
    ran += 1;
  }
  return ran;
}

// The owner's half of a two-person approval. If a guardian has already
// recorded their approve, this completes it and the move runs.
export async function confirmOwnerHalf(profileKey, id) {
  const r = await query(
    `update authorization_requests set owner_confirmed_at = now()
      where id = $1 and profile_key = $2 and status = 'pending' and owner_confirmed_at is null returning *`,
    [id, profileKey],
  );
  const row = r.rows[0];
  if (!row) {
    // already confirmed, or not pending - report the current state rather than 404
    const cur = await query(`select * from authorization_requests where id = $1 and profile_key = $2`, [id, profileKey]);
    return cur.rows[0] ? { ...mapRequest(cur.rows[0]), unchanged: true } : null;
  }
  await recordAuditEvent(null, profileKey, { kind: "authorization_owner_confirmed", detail: { id } });
  if (row.decided_by === "guardian") {
    return executeApproved(profileKey, row, { decidedBy: "guardian", roleId: row.decided_by_role_id, note: row.decision_note });
  }
  return mapRequest(row);
}

// Shared executor: run the parked move, mark executed, write the ledger event.
async function executeApproved(profileKey, row, { decidedBy, roleId = null, autoReason = null, note = null }) {
  await query(
    `update authorization_requests
        set status = 'approved', decided_by = $3, decided_by_role_id = $4, auto_reason = $5, decision_note = coalesce(decision_note,$6), decided_at = now()
      where id = $1 and profile_key = $2 and status = 'pending'`,
    [row.id, profileKey, decidedBy, roleId, autoReason, note],
  );
  const p = typeof row.payload === "string" ? JSON.parse(row.payload || "{}") : row.payload || {};
  try {
    if (row.kind === "internal_transfer") {
      await recordInternalTransfer(profileKey, {
        fromAccountId: p.fromAccountId, toAccountId: p.toAccountId, amount: p.amount,
        currency: p.currency ?? "SGD", idempotencyKey: p.idempotencyKey,
      });
    } else if (row.kind === "card_repayment") {
      await recordCardRepayment(profileKey, {
        fromAccountId: p.fromAccountId, cardAccountId: p.cardAccountId, amount: p.amount,
        currency: p.currency ?? "SGD", idempotencyKey: p.idempotencyKey,
      });
    }
    const done = await query(
      `update authorization_requests set status = 'executed', executed_at = now() where id = $1 and profile_key = $2 returning *`,
      [row.id, profileKey],
    );
    const amt = Number(row.amount) || 0;
    const how =
      autoReason === "within_allowance"
        ? "auto-approved within the weekly allowance the owner delegated"
        : autoReason === "cooling_off_elapsed"
          ? "ran automatically after the cooling-off window (not stopped)"
          : decidedBy === "guardian"
            ? "a linked guardian approved this"
            : "you approved this from the approval queue";
    // the real before/after so Guardian Proof shows numbers, not just words
    let impactSet = [];
    try {
      const [{ buildFinancialTwinBundle }, { buildMoveImpact }] = await Promise.all([
        import("../financial-twin/bundle.js"),
        import("../guardian/decision.js"),
      ]);
      const b = await buildFinancialTwinBundle(profileKey);
      const im = buildMoveImpact({ safeToSpend: b.safeToSpend, twin: b.twin, kind: row.kind, amount: amt });
      if (im.movesOutOfSpendable) {
        impactSet.push({ goalId: "spendable", metric: "spendableNow", before: im.spendableNow.before, after: im.spendableNow.after, unit: "sgd", direction: "down" });
      }
      if (im.debt) {
        impactSet.push({ goalId: "debt", metric: "debtOutstanding", before: im.debt.before, after: im.debt.after, unit: "sgd", direction: "down" });
      }
    } catch {
      /* impact is a nice-to-have on the ledger entry */
    }
    await recordEventSafe({
      profileKey,
      actor: decidedBy === "guardian" ? "guardian" : decidedBy === "auto" ? "system" : "user",
      sourceFeature: "guardian",
      actionType: ACTION_TYPES.GUARDIAN_ACTION,
      status: "completed",
      messageKey: "ledger.authorizationApproved",
      messageParams: { amount: amt, kind: row.kind },
      cause: { trigger: "authorization_approved", requestId: row.id, decidedBy, autoReason },
      afterSnapshot: { amount: amt, kind: row.kind },
      impactSet,
      uncertaintyNote: impactSet.length ? null : `This move ${how} and was carried out.`,
      dedupeKey: `authorization:${row.id}:executed`,
    }).catch(() => {});
    await recordAuditEvent(null, profileKey, { kind: "authorization_executed", detail: { id: row.id, decidedBy, autoReason } });
    return mapRequest(done.rows[0]);
  } catch (err) {
    const failed = await query(
      `update authorization_requests set decision_note = $3 where id = $1 and profile_key = $2 returning *`,
      [row.id, profileKey, `approved but could not execute: ${err.message}`],
    );
    return { ...mapRequest(failed.rows[0]), executionError: err.message };
  }
}

export async function hasLinkedApprover(profileKey) {
  const r = await query(
    `select 1 from lifecycle_roles
      where profile_key = $1 and scope = 'approve' and status = 'active' and subject_key is not null limit 1`,
    [profileKey],
  );
  return r.rows.length > 0;
}

// Approve or decline a specific request. Enforces: a decline always carries
// a note; a two-person account will not execute an approve until the owner
// has also confirmed.
export async function decideAuthRequest(profileKey, id, { decision, note = null, decidedBy = "owner", roleId = null } = {}) {
  if (decision !== "approved" && decision !== "declined") throw new Error("decision must be 'approved' or 'declined'");

  const cur = await query(`select * from authorization_requests where id = $1 and profile_key = $2`, [id, profileKey]);
  const row = cur.rows[0];
  if (!row) return null;
  if (row.status !== "pending") return { ...mapRequest(row), unchanged: true };
  if (decision === "declined" && !String(note || "").trim()) throw new Error("a decline needs a short reason");

  if (decision === "declined") {
    const upd = await query(
      `update authorization_requests set status = 'declined', decided_by = $3, decided_by_role_id = $4, decision_note = $5, decided_at = now()
        where id = $1 and profile_key = $2 and status = 'pending' returning *`,
      [id, profileKey, decidedBy, roleId, note],
    );
    await recordAuditEvent(null, profileKey, { kind: "authorization_declined", detail: { id, decidedBy, note } });
    return mapRequest(upd.rows[0]);
  }

  // approved
  const policy = await getAuthPolicy(profileKey);
  if (policy.requireBoth) {
    if (decidedBy === "owner") {
      // the owner's approve IS their confirm; run only if a guardian already approved
      return confirmOwnerHalf(profileKey, id);
    }
    if (!row.owner_confirmed_at) {
      // record the guardian's half, but wait for the owner
      await query(
        `update authorization_requests set decided_by = $3, decided_by_role_id = $4, decision_note = $5
          where id = $1 and profile_key = $2 and status = 'pending'`,
        [id, profileKey, decidedBy, roleId, note],
      );
      await recordAuditEvent(null, profileKey, { kind: "authorization_approved_pending_owner", detail: { id, decidedBy } });
      return { ...mapRequest(row), blockedPendingOwner: true };
    }
  }
  return executeApproved(profileKey, row, { decidedBy, roleId, note });
}

export async function cancelAuthRequest(profileKey, id) {
  const r = await query(
    `update authorization_requests set status = 'cancelled', decided_at = now()
      where id = $1 and profile_key = $2 and status = 'pending' returning id`,
    [id, profileKey],
  );
  return r.rows.length > 0;
}

// Change the amount on a still-pending move: cancel the old request and
// re-park a fresh one at the new amount (same accounts / kind).
export async function adjustAuthRequest(profileKey, id, newAmount) {
  const amt = Math.round(Number(newAmount) || 0);
  if (!(amt > 0)) throw new Error("a new amount above zero is required");
  const cur = await query(`select * from authorization_requests where id = $1 and profile_key = $2 and status = 'pending'`, [id, profileKey]);
  const row = cur.rows[0];
  if (!row) return null;
  const p = typeof row.payload === "string" ? JSON.parse(row.payload || "{}") : row.payload || {};
  await query(`update authorization_requests set status = 'cancelled', decided_at = now() where id = $1 and profile_key = $2`, [id, profileKey]);
  await recordAuditEvent(null, profileKey, { kind: "authorization_adjusted", detail: { from: Number(row.amount), to: amt } });
  return createAuthRequest(profileKey, {
    kind: row.kind,
    summary: row.summary.replace(/\d[\d,]*/, amt.toLocaleString("en-SG")),
    amount: amt,
    currency: row.currency,
    payload: { ...p, amount: amt },
    reason: row.reason,
    covers: row.covers ?? null,
  });
}

// ---- per-link weekly allowance (owner delegates to one guardian) --------
export async function setLinkAllowance(profileKey, roleId, weekly) {
  const amt = weekly == null || weekly === "" || Number(weekly) <= 0 ? null : Math.round(Number(weekly));
  const r = await query(
    `update lifecycle_roles set auto_approve_weekly = $3, updated_at = now()
      where id = $1 and profile_key = $2 and scope = 'approve' and status = 'active' returning id`,
    [roleId, profileKey, amt],
  );
  if (!r.rows[0]) return null;
  await recordAuditEvent(null, profileKey, { kind: "authorization_allowance_set", detail: { roleId, weekly: amt } });
  return { roleId, weekly: amt };
}
