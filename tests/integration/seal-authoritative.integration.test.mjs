// Server-authoritative Seal (Living Thread, causal-spine round) - real DB.
// Proves the DB-level idempotency: a second commitment with the same
// client idempotency key can never be created, and findSealByIdempotencyKey
// recovers the first one.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [db, atomic] = await Promise.all([
    import("../../lib/db.js"),
    import("../../lib/plan-runtime/atomic-seal.js"),
  ]);
  return { pool: db.pool, atomic };
}

test("goal_commitments_idempotency_key: a duplicate idempotency key cannot create a second active Seal", opts, async (t) => {
  const { pool, atomic } = await mods();
  const pk = `itest-sealidem-${Date.now()}`;
  const key = `idem-${Date.now()}`;
  t.after(async () => {
    await pool.query("delete from goal_commitments where profile_key = $1", [pk]);
  });

  const insert = (dom) =>
    pool.query(
      `insert into goal_commitments (profile_key, domain, monthly_contribution, effective_month, status, source_moment, pause_if_emergency_months_below)
       values ($1, $2, 100, '2027-01', 'active', $3::jsonb, 6) returning id`,
      [pk, dom, JSON.stringify({ idempotencyKey: key })],
    );

  const first = await insert("home");
  assert.ok(first.rows[0].id, "first seal row created");

  // Same key again (different domain, so the one-active-per-domain index
  // is NOT what blocks it) -> the idempotency unique index must reject it.
  let rejected = false;
  try {
    await insert("wedding");
  } catch (e) {
    rejected = true;
    assert.equal(e.code, "23505", "postgres unique_violation on the idempotency key");
  }
  assert.equal(rejected, true, "the DB refused a second Seal for the same idempotency key");

  const recovered = await atomic.findSealByIdempotencyKey(pk, key);
  assert.ok(recovered && recovered.id === first.rows[0].id, "the original Seal is recoverable by its idempotency key");
});
