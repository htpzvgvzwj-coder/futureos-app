// Studio first-use seed - real Neon DB. Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [seed, planRuntime, db] = await Promise.all([
    import("../../lib/future-field/seed.js"),
    import("../../lib/plan-runtime/index.js"),
    import("../../lib/db.js"),
  ]);
  return { seed, planStore: planRuntime.planStore, pool: db.pool };
}

async function mkUser(pool, tag) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`itest-seed-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@futureos.test`],
  );
  return r.rows[0].id;
}
async function cleanup(pool, uid) {
  const plans = await pool.query("select id from plans where profile_key = $1", [uid]);
  for (const { id } of plans.rows) {
    await pool.query("delete from plan_branches where plan_id = $1", [id]);
    await pool.query("delete from plan_versions where plan_id = $1", [id]);
  }
  await pool.query("delete from plans where profile_key = $1", [uid]);
  await pool.query("delete from change_ledger_events where profile_key = $1", [uid]);
  await pool.query("delete from users where id = $1", [uid]);
}

test("seedFirstPath (confirmed): creates a plan + version + branch; loadSeededPath returns it; reload keeps it", opts, async (t) => {
  const { seed, planStore, pool } = await mods();
  const uid = await mkUser(pool, "home");
  t.after(() => cleanup(pool, uid));

  const res = await seed.seedFirstPath(uid, "home", {
    answers: { price_band: "400k-600k", property_type: "hdb_resale", target_month: "2029-06" },
    mode: "confirmed",
  });
  assert.equal(res.ok, true);
  assert.ok(res.planId);
  assert.ok(res.branchId);
  assert.equal(res.sealBlockedReason, null);
  assert.equal(res.provenance.estimated_price, "user_range");

  const version = await planStore.getCurrentPlanVersion(res.planId);
  assert.equal(version.data.estimated_price, 500000);
  assert.equal(version.data.property_type, "hdb_resale");
  assert.equal(version.data.__seedMode, "confirmed");

  const loaded = await seed.loadSeededPath(uid, "home");
  assert.ok(loaded);
  assert.equal(loaded.data.estimated_price, 500000);
  assert.equal(loaded.data.__seedMode, undefined, "meta keys are stripped from the reality-path view");
  assert.equal(loaded.sealable, true);

  // a second seed (a changed assumption) appends a new version, same plan
  const res2 = await seed.seedFirstPath(uid, "home", {
    answers: { price_band: "400k-600k", property_type: "hdb_resale", target_month: "2029-06" },
    exactAmounts: { monthly_contribution: 1500 },
    mode: "confirmed",
  });
  assert.equal(res2.ok, true);
  assert.equal(res2.planId, res.planId, "same plan, not a new one");
  const v2 = await planStore.getCurrentPlanVersion(res.planId);
  assert.equal(v2.data.monthly_contribution, 1500);

  // the first input is on the Change Ledger
  const led = await pool.query(
    `select action_type, status, source_feature from change_ledger_events where profile_key = $1 order by occurred_at asc`,
    [uid],
  );
  assert.ok(led.rows.length >= 1);
  assert.equal(led.rows[0].source_feature, "home");
  assert.equal(led.rows[0].status, "projected", "a seeded draft is projected, not a real money change");
});

test("seedFirstPath (estimate): fills defaults with system_estimate provenance and blocks sealing", opts, async (t) => {
  const { seed, pool } = await mods();
  const uid = await mkUser(pool, "emergency");
  t.after(() => cleanup(pool, uid));

  const res = await seed.seedFirstPath(uid, "emergency", { answers: {}, mode: "estimate" });
  assert.equal(res.ok, true);
  assert.equal(res.mode, "estimate");
  assert.equal(res.sealBlockedReason, "estimate_needs_confirmation");
  assert.ok(res.needsConfirmation.length > 0);
  for (const p of Object.values(res.provenance)) assert.equal(p, "system_estimate");

  const loaded = await seed.loadSeededPath(uid, "emergency");
  assert.equal(loaded.sealable, false);
  assert.equal(loaded.sealBlockedReason, "estimate_needs_confirmation");
});

test("seedFirstPath (confirmed) rejects when a required answer is missing", opts, async (t) => {
  const { seed, pool } = await mods();
  const uid = await mkUser(pool, "reject");
  t.after(() => cleanup(pool, uid));

  const res = await seed.seedFirstPath(uid, "home", { answers: { price_band: "400k-600k" }, mode: "confirmed" });
  assert.equal(res.ok, false);
  assert.equal(res.error, "missing_answers");
  assert.ok(res.missing.includes("target_month"));
});

test("two users' seeded paths are isolated", opts, async (t) => {
  const { seed, pool } = await mods();
  const a = await mkUser(pool, "isoA");
  const b = await mkUser(pool, "isoB");
  t.after(async () => { await cleanup(pool, a); await cleanup(pool, b); });

  await seed.seedFirstPath(a, "travel", { answers: { distance_band: "regional", trip_month: "2027-06", travellers: 2 }, mode: "confirmed" });
  const bPath = await seed.loadSeededPath(b, "travel");
  assert.equal(bPath, null, "user B has no travel path");
  const aPath = await seed.loadSeededPath(a, "travel");
  assert.ok(aPath && aPath.data.destination_type === "regional");
});
