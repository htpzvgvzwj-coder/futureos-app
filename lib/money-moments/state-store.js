// Money Moment lifecycle - the ONLY place moment state is persisted. The
// moments themselves are derived every request (lib/money-moments/build.js);
// this table just remembers what the user did with each one, keyed by a
// stable `momentKey`.
//
// Auto-reopen: a `resolved` / `snoozed` moment whose evidence hash has
// since changed is treated as `new` again - the underlying signal became
// true again, so it must resurface.

import { query } from "../db.js";

export const MOMENT_STATES = ["new", "reviewed", "snoozed", "resolved"];
export const MOMENT_ACTIONS = ["reviewed", "snoozed", "resolved", "reopened", "acknowledged"];

function mapRow(r) {
  return {
    momentKey: r.moment_key,
    state: r.state,
    evidenceHash: r.evidence_hash,
    snoozedUntil: r.snoozed_until ? new Date(r.snoozed_until).toISOString() : null,
    lastAction: r.last_action,
    note: r.note ?? null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

// All persisted lifecycle rows for a profile, as a Map keyed by momentKey.
export async function getMomentStates(profileKey) {
  const res = await query(
    `select * from money_moment_state where profile_key = $1`,
    [profileKey],
  );
  const map = new Map();
  for (const row of res.rows) map.set(row.moment_key, mapRow(row));
  return map;
}

// Resolve the EFFECTIVE state for a freshly-derived moment given its stored
// row (may be undefined) and its current evidence hash + now. Never mutates
// the DB - pure. The aggregator calls this for every moment.
export function effectiveState(stored, currentEvidenceHash, nowMs = Date.now()) {
  if (!stored) return { state: "new", reopened: false };
  // Evidence changed since the last user action -> the signal moved; the
  // moment is new again (reopened).
  if (stored.evidenceHash && currentEvidenceHash && stored.evidenceHash !== currentEvidenceHash) {
    return { state: "new", reopened: true };
  }
  if (stored.state === "snoozed") {
    const until = stored.snoozedUntil ? Date.parse(stored.snoozedUntil) : 0;
    if (until && until <= nowMs) return { state: "new", reopened: true };
    return { state: "snoozed", reopened: false };
  }
  return { state: stored.state, reopened: false };
}

// Persist a user action on a moment. `evidenceHash` is the moment's hash AT
// THE TIME of the action, so a later evidence change auto-reopens it.
export async function setMomentState(profileKey, momentKey, action, { evidenceHash = null, snoozeDays = null, note = null } = {}) {
  if (!MOMENT_ACTIONS.includes(action)) throw new Error(`bad moment action: ${action}`);
  const state =
    action === "reviewed"
      ? "reviewed"
      : action === "snoozed"
        ? "snoozed"
        : action === "resolved" || action === "acknowledged"
          ? "resolved" // acknowledging a detection = handled; it leaves the active stream
          : "new"; // reopened
  const snoozedUntil =
    action === "snoozed" ? new Date(Date.now() + Math.max(1, Number(snoozeDays) || 7) * 86_400_000).toISOString() : null;

  const res = await query(
    `insert into money_moment_state (profile_key, moment_key, state, evidence_hash, snoozed_until, last_action, note, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7, now())
     on conflict (profile_key, moment_key) do update
       set state = excluded.state,
           evidence_hash = excluded.evidence_hash,
           snoozed_until = excluded.snoozed_until,
           last_action = excluded.last_action,
           note = coalesce(excluded.note, money_moment_state.note),
           updated_at = now()
     returning *`,
    [profileKey, momentKey, state, evidenceHash, snoozedUntil, action, note],
  );
  return mapRow(res.rows[0]);
}
