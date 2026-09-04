// Life Thread snapshots — the data foundation for Life Memory playback
// (Life vision Phase 2). Forward-only: we capture the CURRENT Life Thread
// state and pin it to the most recent direction-changing Change Ledger
// event that has no snapshot yet, plus a one-time `baseline`. We never
// fabricate a past line for events older than this system — Life Memory
// falls back to the per-event Before/After record for those.
//
// Pure shape helpers (compactThread, figuresFrom, movedBetween) live in
// ./snapshot-shape.js so a client component can import them without pg.

import { query } from "../db.js";
import { compactThread, figuresFrom } from "./snapshot-shape.js";

export { compactThread, movedBetween } from "./snapshot-shape.js";

export async function getBaseline(profileKey) {
  const r = await query(
    `select * from life_thread_snapshots where profile_key = $1 and kind = 'baseline' limit 1`,
    [profileKey],
  );
  return r.rows[0] ?? null;
}

export async function listSnapshots(profileKey) {
  const r = await query(
    `select id, ledger_event_id, kind, captured_at, event_at, thread, free_monthly, committed_monthly, safety_months
       from life_thread_snapshots where profile_key = $1
      order by (kind = 'baseline') asc, event_at desc nulls last, captured_at desc`,
    [profileKey],
  );
  return r.rows;
}

export async function getSnapshotForEvent(profileKey, ledgerEventId) {
  const r = await query(
    `select * from life_thread_snapshots where profile_key = $1 and ledger_event_id = $2 limit 1`,
    [profileKey, ledgerEventId],
  );
  return r.rows[0] ?? null;
}

// The set of ledger-event ids that already have a snapshot (so Life Memory
// can mark those records replayable).
export async function snapshottedEventIds(profileKey) {
  const r = await query(
    `select ledger_event_id from life_thread_snapshots where profile_key = $1 and ledger_event_id is not null`,
    [profileKey],
  );
  return new Set(r.rows.map((x) => x.ledger_event_id));
}

// Capture the current thread. Called on Life tab load with the live
// compact thread + the id/time of the most recent direction-changing
// event (from buildLifeMemory().latest). Idempotent per event.
export async function reconcileSnapshots(profileKey, { thread, latestEventId = null, latestEventAt = null } = {}) {
  const ct = thread && Array.isArray(thread.nodes) && thread.numbers ? thread : compactThread(thread || {});
  const fig = figuresFrom(ct);
  let captured = 0;

  const baseline = await getBaseline(profileKey);
  if (!baseline) {
    await query(
      `insert into life_thread_snapshots (profile_key, ledger_event_id, kind, event_at, thread, free_monthly, committed_monthly, safety_months)
       values ($1, null, 'baseline', null, $2, $3, $4, $5)
       on conflict (profile_key) where kind = 'baseline' do nothing`,
      [profileKey, JSON.stringify(ct), fig.free_monthly, fig.committed_monthly, fig.safety_months],
    );
    captured += 1;
  }

  if (latestEventId) {
    const existing = await getSnapshotForEvent(profileKey, latestEventId);
    if (!existing) {
      await query(
        `insert into life_thread_snapshots (profile_key, ledger_event_id, kind, event_at, thread, free_monthly, committed_monthly, safety_months)
         values ($1, $2, 'after_event', $3, $4, $5, $6, $7)
         on conflict (profile_key, ledger_event_id) where ledger_event_id is not null do nothing`,
        [profileKey, latestEventId, latestEventAt ?? new Date().toISOString(), JSON.stringify(ct), fig.free_monthly, fig.committed_monthly, fig.safety_months],
      );
      captured += 1;
    }
  }

  return { ok: true, captured };
}
