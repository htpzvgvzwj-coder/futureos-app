// Life Thread snapshots — reconcile (baseline + forward-only per-event
// capture), list, get-for-event; and the sample-data history seed. Real
// Neon DB. Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [snap, ledger, sample, db] = await Promise.all([
    import("../../lib/life/snapshot.js"),
    import("../../lib/change-ledger/store.js"),
    import("../../lib/sample-data/build.js"),
    import("../../lib/db.js"),
  ]);
  return { snap, ledger, sample, pool: db.pool };
}
async function makeUser(pool) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`ls-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@futureos.test`],
  );
  return r.rows[0].id;
}
async function cleanup(pool, uid) {
  for (const t of ["life_thread_snapshots", "change_ledger_events"]) {
    await pool.query(`delete from ${t} where profile_key = $1`, [uid]).catch(() => {});
  }
  await pool.query(`delete from users where id = $1`, [uid]).catch(() => {});
}

const ct = {
  direction: "x", directionKey: "x", directionParams: null,
  weather: { id: "calm", label: "Calm" },
  numbers: [
    { id: "free", label: "Free each month", value: "SGD 3,600" },
    { id: "committed", label: "Promised to your future", value: "SGD 1,900/mo" },
    { id: "safety", label: "Safety buffer", value: "4.9 months" },
  ],
  nodes: [{ id: "safety", label: "Safety", state: "solid", valueText: "4.9 months", note: null }],
};

test("reconcile: baseline once, then forward-only per-event capture; list + get", opts, async () => {
  const { snap, ledger, pool } = await mods();
  const uid = await makeUser(pool);
  try {
    // an event to pin a snapshot to
    const e = await ledger.recordEventSafe({
      profileKey: uid, actor: "user", sourceFeature: "wedding", actionType: "plan_updated", status: "active",
      messageKey: "changeLedger.event.plan_updated.headline",
      impactSet: [{ goalId: "cashflow", metric: "freeMonthlyCashflow", before: 4050, after: 3600, unit: "sgd", direction: "down" }],
      occurredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    });
    const eid = e.event.id;

    const r1 = await snap.reconcileSnapshots(uid, { thread: ct, latestEventId: eid, latestEventAt: e.event.occurred_at });
    assert.equal(r1.captured, 2, "baseline + the event");

    // idempotent: nothing new on a second pass
    const r2 = await snap.reconcileSnapshots(uid, { thread: ct, latestEventId: eid });
    assert.equal(r2.captured, 0);

    const list = await snap.listSnapshots(uid);
    assert.equal(list.length, 2);
    assert.equal(list.find((s) => s.kind === "baseline") != null, true);
    assert.equal(Number(list.find((s) => s.ledger_event_id === eid).free_monthly), 3600);

    const one = await snap.getSnapshotForEvent(uid, eid);
    assert.equal(one.thread.numbers.length, 3);
    assert.equal(one.thread.weather.label, "Calm");

    const ids = await snap.snapshottedEventIds(uid);
    assert.ok(ids.has(eid));
  } finally {
    await cleanup(pool, uid);
  }
});

test("sample-data seeds a populated Life Memory history + matching snapshots", opts, async () => {
  const { sample, pool } = await mods();
  const uid = await makeUser(pool);
  try {
    await sample.buildSampleAccount(uid, { wipeFirst: false });

    const evs = await pool.query(
      `select action_type, source_feature, impact_set from change_ledger_events where profile_key = $1 order by occurred_at asc`,
      [uid],
    );
    assert.ok(evs.rows.length >= 4, "at least four direction-changing events");
    assert.ok(evs.rows.every((r) => Array.isArray(r.impact_set) && r.impact_set.length > 0), "each carries an impact_set");

    const snaps = await pool.query(
      `select kind, event_at, free_monthly, safety_months from life_thread_snapshots where profile_key = $1`,
      [uid],
    );
    assert.ok(snaps.rows.some((s) => s.kind === "baseline"), "a baseline snapshot");
    assert.ok(snaps.rows.filter((s) => s.kind === "after_event").length >= 4, "one snapshot per seeded event");
    // the figures should actually differ across snapshots (a moving line)
    const frees = new Set(snaps.rows.map((s) => Number(s.free_monthly)));
    assert.ok(frees.size >= 3, "the free-cashflow figure moves across the history");

    // wipe takes the snapshots with it
    await sample.wipeSampleAccount(uid);
    const after = await pool.query(`select count(*) n from life_thread_snapshots where profile_key = $1`, [uid]);
    assert.equal(Number(after.rows[0].n), 0);
  } finally {
    await cleanup(pool, uid);
  }
});
