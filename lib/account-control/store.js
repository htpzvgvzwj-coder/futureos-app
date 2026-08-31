// Account control - onboarding, consent, lifecycle roles, audit trail,
// data export and account deletion (Usable RC, sections 四 / 十三 / 十六).
//
// All writes are parameterised. Audit events are append-only. Deletion
// runs a cascade in one transaction and revokes every active session.

import { query, withTransaction } from "../db.js";

const runner = (r) => (typeof r?.query === "function" ? r : { query: (t, p) => query(t, p) });

// ---- audit ------------------------------------------------------

export async function recordAuditEvent(r, profileKey, { kind, detail = {}, actorKey = null }) {
  const run = runner(r);
  await run.query(
    `insert into audit_events (profile_key, actor_key, kind, detail) values ($1,$2,$3,$4::jsonb)`,
    [profileKey, actorKey ?? profileKey, kind, JSON.stringify(scrubPii(detail))],
  );
}
// Keep obvious PII out of the audit detail blob.
function scrubPii(d) {
  const out = {};
  for (const [k, v] of Object.entries(d ?? {})) {
    if (/email|phone|password|token|nric|passport|dob/i.test(k)) out[k] = "[redacted]";
    else out[k] = v;
  }
  return out;
}
export async function listAuditEvents(profileKey, { limit = 100 } = {}) {
  const res = await query(`select id, kind, detail, created_at from audit_events where profile_key = $1 order by created_at desc limit ${Number(limit) || 100}`, [profileKey]);
  return res.rows.map((r) => ({ id: r.id, kind: r.kind, detail: r.detail, createdAt: r.created_at }));
}

// ---- onboarding ----------------------------------------------

export const ACCOUNT_TYPES = ["individual", "youth", "guardian_managed_child", "household"];
export const ONBOARDING_STEPS = ["account_type", "consent", "add_reality", "first_result", "complete"];

export async function getOnboarding(profileKey) {
  const res = await query(`select * from user_onboarding where profile_key = $1`, [profileKey]);
  if (!res.rows[0]) return { profileKey, accountType: null, status: "not_started", step: "account_type", completedAt: null };
  const r = res.rows[0];
  return { profileKey, accountType: r.account_type, status: r.status, step: r.step, completedAt: r.completed_at };
}

export async function setAccountType(profileKey, accountType) {
  if (!ACCOUNT_TYPES.includes(accountType)) throw new Error(`invalid account_type: ${accountType}`);
  await query(
    `insert into user_onboarding (profile_key, account_type, status, step)
     values ($1,$2,'started','consent')
     on conflict (profile_key) do update set account_type = excluded.account_type, step = 'consent', updated_at = now()`,
    [profileKey, accountType],
  );
  return getOnboarding(profileKey);
}

export async function advanceOnboarding(profileKey, step) {
  if (!ONBOARDING_STEPS.includes(step)) throw new Error(`invalid step: ${step}`);
  const status = step === "complete" ? "complete" : step === "add_reality" ? "consent_done" : step === "first_result" ? "reality_added" : "started";
  await query(
    `update user_onboarding set step = $2, status = $3, completed_at = case when $2 = 'complete' then now() else completed_at end, updated_at = now()
     where profile_key = $1`,
    [profileKey, step, status],
  );
  return getOnboarding(profileKey);
}

// ---- consent -----------------------------------------------

export const CONSENT_SCOPES = ["account_data", "transaction_data", "assets_liabilities", "planning_data", "shared_data", "guardian_monitoring"];
const REQUIRED_SCOPES = new Set(["account_data"]);

export async function getConsent(profileKey) {
  const res = await query(
    `select distinct on (scope) scope, granted, required, version, created_at
     from consent_records where profile_key = $1 order by scope, created_at desc`,
    [profileKey],
  );
  const byScope = Object.fromEntries(res.rows.map((r) => [r.scope, { granted: r.granted, required: r.required, version: r.version, at: r.created_at }]));
  return CONSENT_SCOPES.map((scope) => ({
    scope,
    granted: byScope[scope]?.granted ?? false,
    required: REQUIRED_SCOPES.has(scope),
    version: byScope[scope]?.version ?? null,
    decidedAt: byScope[scope]?.at ?? null,
  }));
}

export async function setConsent(profileKey, scope, granted, { source = "onboarding" } = {}) {
  if (!CONSENT_SCOPES.includes(scope)) throw new Error(`invalid consent scope: ${scope}`);
  await query(
    `insert into consent_records (profile_key, scope, granted, required, source) values ($1,$2,$3,$4,$5)`,
    [profileKey, scope, Boolean(granted), REQUIRED_SCOPES.has(scope), source],
  );
  await recordAuditEvent(null, profileKey, { kind: granted ? "consent_granted" : "consent_revoked", detail: { scope, source } });
  return getConsent(profileKey);
}

// ---- lifecycle roles --------------------------------------

export const LIFECYCLE_ROLES = ["account_owner", "guardian", "dependent", "household_member", "trusted_contact", "beneficiary_placeholder"];
export const ROLE_SCOPES = ["view", "contribute", "suggest", "approve", "manage", "revoke"];

export async function listRoles(profileKey) {
  const res = await query(`select * from lifecycle_roles where profile_key = $1 and status <> 'revoked' order by created_at asc`, [profileKey]);
  return res.rows.map(mapRole);
}
export async function grantRole(profileKey, { subjectKey = null, role, scope = "view", legalConfirmationRequired = false }) {
  if (!LIFECYCLE_ROLES.includes(role)) throw new Error(`invalid role: ${role}`);
  if (!ROLE_SCOPES.includes(scope)) throw new Error(`invalid scope: ${scope}`);
  const res = await query(
    `insert into lifecycle_roles (profile_key, subject_key, role, scope, status, legal_confirmation_required)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [profileKey, subjectKey, role, scope, subjectKey ? "active" : "pending", legalConfirmationRequired || role === "beneficiary_placeholder"],
  );
  await recordAuditEvent(null, profileKey, { kind: "role_granted", detail: { role, scope, subjectPresent: Boolean(subjectKey) } });
  return mapRole(res.rows[0]);
}
export async function revokeRole(profileKey, id) {
  const res = await query(`update lifecycle_roles set status = 'revoked', revoked_at = now() where id = $1 and profile_key = $2 returning id`, [id, profileKey]);
  if (res.rows[0]) await recordAuditEvent(null, profileKey, { kind: "role_revoked", detail: { roleId: id } });
  return res.rows.length > 0;
}
function mapRole(r) {
  return { id: r.id, subjectKey: r.subject_key, role: r.role, scope: r.scope, status: r.status, legalConfirmationRequired: r.legal_confirmation_required, createdAt: r.created_at };
}

// ---- export --------------------------------------------

// Every table a user owns, keyed by profile_key (for export - order does
// not matter).
const OWNED_TABLES = [
  "bank_accounts", "bank_transactions", "financial_assets", "liabilities", "income_streams",
  "recurring_obligations", "ripple_events", "assets", "plans", "goal_commitments",
  "consent_records", "lifecycle_roles", "import_batches", "audit_events", "user_onboarding",
];

// For the delete cascade the order is child-tables-first so a foreign key
// (bank_transactions.account_id, financial_assets.linked_account_id,
// bank_transactions.import_batch_id, ...) never blocks a parent delete.
const DELETE_ORDER = [
  "bank_transactions", "import_batches", "financial_assets", "liabilities", "income_streams",
  "recurring_obligations", "ripple_events", "bank_accounts", "goal_commitments", "assets",
  "plans", "consent_records", "lifecycle_roles",
];

export async function exportUserData(profileKey) {
  const out = { profileKey, exportedAt: new Date().toISOString(), tables: {} };
  for (const table of OWNED_TABLES) {
    try {
      const res = await query(`select * from ${table} where profile_key = $1`, [profileKey]);
      out.tables[table] = res.rows;
    } catch {
      out.tables[table] = { error: "unreadable" };
    }
  }
  await recordAuditEvent(null, profileKey, { kind: "data_exported", detail: { tables: OWNED_TABLES.length } });
  return out;
}

// ---- delete -------------------------------------------

export async function requestAccountDeletion(profileKey, { reason = null } = {}) {
  return withTransaction(async (tx) => {
    await tx.query(
      `insert into account_deletions (profile_key, reason, status) values ($1,$2,'processing')
       on conflict (profile_key) do update set requested_at = now(), status = 'processing', reason = excluded.reason`,
      [profileKey, reason],
    );
    // Cascade delete owned rows, child tables first. `audit_events` +
    // `account_deletions` are kept (minimised) as the compliance record of
    // the deletion itself.
    let removed = 0;
    for (const table of DELETE_ORDER) {
      const res = await tx.query(`delete from ${table} where profile_key = $1`, [profileKey]);
      removed += res.rowCount ?? 0;
    }
    // revoke every active session so a stale cookie cannot log back in
    await tx.query(`update user_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [profileKey]);
    // scrub the login identity but keep the row for audit integrity
    await tx.query(
      `update users set email = concat('deleted+', id, '@futureos.invalid'), password_hash = '', display_name = '' where id = $1`,
      [profileKey],
    );
    await tx.query(`update account_deletions set status = 'completed', completed_at = now() where profile_key = $1`, [profileKey]);
    await recordAuditEvent(tx, profileKey, { kind: "account_delete_requested", detail: { rowsRemoved: removed, reason } });
    return { rowsRemoved: removed, sessionsRevoked: true };
  });
}
