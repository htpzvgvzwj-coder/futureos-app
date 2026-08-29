import { query, pool } from "../db.js";
import { validateEventDraft, redactForShared, VISIBILITIES } from "./events.js";

// Change Ledger - the ONE writer. Every feature calls recordEvent; nobody
// inserts into change_ledger_events directly and no page fakes history on a
// click. An event is only written after the real state change it describes
// has itself been persisted - the caller decides that ordering (and, where
// it can, passes its own transaction client so the state change and the
// ledger row commit together).

function toArrayLiteral(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return "{}";
  return `{${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(",")}}`;
}

// draft shape (camelCase):
//   profileKey, actor, sourceFeature, actionType, status,
//   planId?, planBranchId?, commitmentId?, relatedGoalIds?, visibility?,
//   cause?, beforeSnapshot?, afterSnapshot?, impactSet?, evidenceRefs?,
//   confidence?, uncertaintyNote?, supersedesEventId?,
//   messageKey, messageParams?, dedupeKey?, occurredAt?
//
// Pass `client` (a pg client already inside a transaction) to enlist this
// write in the caller's transaction. Omit it to write on the pool.
//
// Returns { event } on success, { event: existing, duplicate: true } if a
// row with the same (profileKey, dedupeKey) already exists, or throws
// { code: "INVALID_LEDGER_EVENT", errors } for a malformed draft.
export async function recordEvent(draft, { client = null } = {}) {
  const { ok, errors } = validateEventDraft(draft);
  if (!ok) {
    const err = new Error("invalid_ledger_event");
    err.code = "INVALID_LEDGER_EVENT";
    err.errors = errors;
    throw err;
  }

  const visibility = draft.visibility && VISIBILITIES.includes(draft.visibility) ? draft.visibility : "private";
  const shouldRedact = visibility === "shared";
  const cause = shouldRedact ? redactForShared(draft.cause ?? {}) : draft.cause ?? {};
  const before = shouldRedact ? redactForShared(draft.beforeSnapshot ?? {}) : draft.beforeSnapshot ?? {};
  const after = shouldRedact ? redactForShared(draft.afterSnapshot ?? {}) : draft.afterSnapshot ?? {};
  const impactSet = shouldRedact ? redactForShared(draft.impactSet ?? []) : draft.impactSet ?? [];

  const params = [
    draft.profileKey,
    draft.actor,
    draft.sourceFeature,
    draft.actionType,
    draft.status,
    draft.planId ?? null,
    draft.planBranchId ?? null,
    draft.commitmentId ?? null,
    toArrayLiteral(draft.relatedGoalIds),
    visibility,
    JSON.stringify(cause),
    JSON.stringify(before),
    JSON.stringify(after),
    JSON.stringify(impactSet),
    JSON.stringify(draft.evidenceRefs ?? []),
    draft.confidence ?? null,
    draft.uncertaintyNote ?? null,
    draft.supersedesEventId ?? null,
    draft.messageKey,
    JSON.stringify(draft.messageParams ?? {}),
    draft.dedupeKey ?? null,
    draft.occurredAt ?? null,
  ];

  const sql = `
    insert into change_ledger_events
      (profile_key, actor, source_feature, action_type, status, plan_id, plan_branch_id, commitment_id,
       related_goal_ids, visibility, cause, before_snapshot, after_snapshot, impact_set, evidence_refs,
       confidence, uncertainty_note, supersedes_event_id, message_key, message_params, dedupe_key, occurred_at)
    values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, coalesce($22::timestamptz, now()))
    returning *`;

  const runner = client ?? { query: (text, values) => query(text, values) };
  try {
    const result = await runner.query(sql, params);
    return { event: result.rows[0], duplicate: false };
  } catch (error) {
    // change_ledger_events_dedupe_idx - a retry / double-submit with the
    // same dedupe_key. Return the event that already landed, not an error:
    // the caller's real state write is idempotent too, so this is success.
    if (error?.code === "23505" && draft.dedupeKey) {
      const existing = await (runner.query
        ? runner.query(`select * from change_ledger_events where profile_key = $1 and dedupe_key = $2 limit 1`, [
            draft.profileKey,
            draft.dedupeKey,
          ])
        : null);
      if (existing?.rows?.[0]) return { event: existing.rows[0], duplicate: true };
    }
    throw error;
  }
}

// Never throws - a ledger failure must not roll back a real state change
// that already succeeded. Logs and returns null. Use this from routes where
// the state write is already committed and separate.
export async function recordEventSafe(draft, options) {
  try {
    return await recordEvent(draft, options);
  } catch (error) {
    console.error("[change-ledger] recordEvent failed:", error?.code || error?.message, error?.errors || "");
    return null;
  }
}

const FILTERS = {
  all: null,
  mine: `actor = 'user'`,
  guardian: `actor = 'guardian'`,
  plan: `source_feature in ('home','wedding','retirement','loan','investment','travel','family','mirror')`,
  quotes: `source_feature in ('quote_to_plan')`,
  shared: `visibility = 'shared'`,
  outcomes: `status in ('observed','completed')`,
};

export async function listEvents(profileKey, { filter = "all", since = null, limit = 100 } = {}) {
  const clauses = [`profile_key = $1`, `visibility <> 'system'`];
  const values = [profileKey];
  const filterClause = FILTERS[filter];
  if (filterClause) clauses.push(filterClause);
  if (since) {
    values.push(since);
    clauses.push(`occurred_at > $${values.length}`);
  }
  values.push(Math.min(limit, 250));
  const result = await query(
    `select * from change_ledger_events where ${clauses.join(" and ")} order by occurred_at desc limit $${values.length}`,
    values,
  );
  return result.rows;
}

// The most recent ledger event for a given commitment (optionally of one
// action_type) - so a revoke can point supersedes_event_id at the create
// event, and a pause-check can tell whether an open pause event already
// exists.
export async function getLatestEventForCommitment(profileKey, commitmentId, actionType = null) {
  const values = [profileKey, commitmentId];
  let sql = `select * from change_ledger_events where profile_key = $1 and commitment_id = $2`;
  if (actionType) {
    values.push(actionType);
    sql += ` and action_type = $3`;
  }
  sql += ` order by occurred_at desc limit 1`;
  const result = await query(sql, values);
  return result.rows[0] ?? null;
}

export async function getEvent(id, profileKey) {
  const result = await query(
    `select * from change_ledger_events where id = $1 and profile_key = $2 and visibility <> 'system' limit 1`,
    [id, profileKey],
  );
  return result.rows[0] ?? null;
}

// "What changed since you last opened FutureOS" - Delta Replay's source.
export async function listEventsSince(profileKey, sinceIso) {
  return listEvents(profileKey, { filter: "all", since: sinceIso, limit: 50 });
}

export { pool as ledgerPool };
