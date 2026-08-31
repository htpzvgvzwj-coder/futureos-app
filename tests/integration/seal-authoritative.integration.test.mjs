// Blocker 4 - the Seal is server-authoritative inside ONE transaction:
//   - a STALE branch (peeled before a newer plan version) is a conflict,
//     never an overwrite
//   - freed / pins / feasibility come from the LOCKED branch data via the
//     recompute callback, not any pre-read copy
//   - idempotency is PER USER; a duplicate key can't create a 2nd commit
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [store, atomic, db] = await Promise.all([
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/plan-runtime/atomic-seal.js"),
    import("../../lib/db.js"),
  ]);
  return { store, atomic, pool: db.pool };
}

const okRecompute = (freed = 0) => () => ({ feasibility: { sealable: true }, constraintCheck: { ok: true }, serverFreed: freed, serverAddedPressure: 0 });

async function seed(store, pool, pk) {
  const plan = await store.getOrCreatePlan(pk, { domain: "loan", goalKey: "loan", title: "loan" });
  const v1 = await store.appendPlanVersion(plan.id, pk, { patch: { monthly_contribution: 500 }, cause: { trigger: "itest" }, actor: "system" });
  const cur = await store.getCurrentPlanVersion(plan.id);
  const branch = await store.createBranch(plan.id, pk, {
    label: "b", baseVersion: cur.version, data: { monthly_contribution: 900 },
    delta: { before: { monthly_contribution: 500 }, after: { monthly_contribution: 900 } },
    feasibility: { available: true, sealable: true },
  });
  return { plan, branch, v1 };
}

test("STALE branch: a plan version appended after the peel makes the Seal a 409 stale_branch, never an overwrite", opts, async (t) => {
  const { store, atomic, pool } = await mods();
  const pk = `itest-stale-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from guardian_policies where plan_id = $1", [id]);
      await pool.query("delete from goal_commitments where plan_id = $1", [id]);
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from change_ledger_events where profile_key = $1", [pk]);
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const { plan, branch } = await seed(store, pool, pk);
  // The plan moves on AFTER the branch was peeled.
  await store.appendPlanVersion(plan.id, pk, { patch: { monthly_contribution: 550 }, cause: { trigger: "itest_advance" }, actor: "user" });

  await assert.rejects(
    atomic.sealAtomic({
      profileKey: pk, domain: "loan", planId: plan.id, branchId: branch.id,
      monthlyAmount: 900, effectiveMonth: "2026-02", priorMonthlyContribution: 500, emergencyFloorMonths: 6,
      allocationInput: null, allowedTargets: ["emergency"], realityData: { monthly_contribution: 550 },
      recompute: okRecompute(0), sealPreview: { execution: "shadow_only" }, idempotencyKey: "k-stale",
    }),
    (e) => e.code === "STALE_BRANCH",
  );
  const c = await pool.query("select count(*)::int n from goal_commitments where profile_key = $1", [pk]);
  assert.equal(c.rows[0].n, 0, "nothing was sealed");
});

test("recompute runs on the LOCKED branch data; a NOT_SEALABLE / VIOLATES_PINS verdict blocks the Seal", opts, async (t) => {
  const { store, atomic, pool } = await mods();
  const pk = `itest-recompute-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });
  const { plan, branch } = await seed(store, pool, pk);

  let sawData = null;
  await assert.rejects(
    atomic.sealAtomic({
      profileKey: pk, domain: "loan", planId: plan.id, branchId: branch.id,
      monthlyAmount: 900, effectiveMonth: "2026-02", priorMonthlyContribution: 500, emergencyFloorMonths: 6,
      allocationInput: null, allowedTargets: ["emergency"], realityData: { monthly_contribution: 500 },
      recompute: (lockedData) => {
        sawData = lockedData;
        return { feasibility: { sealable: false, sealableReason: "budget_below_core" }, constraintCheck: { ok: true }, serverFreed: 0, serverAddedPressure: 0 };
      },
      sealPreview: {}, idempotencyKey: "k-recompute",
    }),
    (e) => e.code === "NOT_SEALABLE",
  );
  assert.equal(sawData?.monthly_contribution, 900, "recompute received the LOCKED branch data, not a client copy");
});

test("idempotency is PER USER: same key + two users -> two independent commitments; same key + same user -> one", opts, async (t) => {
  const { store, atomic, pool } = await mods();
  const uA = `itest-idemA-${Date.now()}`;
  const uB = `itest-idemB-${Date.now()}`;
  t.after(async () => {
    for (const pk of [uA, uB]) {
      const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
      for (const { id } of plans.rows) {
        await pool.query("delete from guardian_policies where plan_id = $1", [id]);
        await pool.query("delete from goal_commitments where plan_id = $1", [id]);
        await pool.query("delete from plan_branches where plan_id = $1", [id]);
        await pool.query("delete from plan_versions where plan_id = $1", [id]);
      }
      await pool.query("delete from change_ledger_events where profile_key = $1", [pk]);
      await pool.query("delete from plans where profile_key = $1", [pk]);
    }
  });

  const KEY = `shared-key-${Date.now()}`;
  const runFor = async (pk) => {
    const { plan, branch } = await seed(store, pool, pk);
    return atomic.sealAtomic({
      profileKey: pk, domain: "loan", planId: plan.id, branchId: branch.id,
      monthlyAmount: 900, effectiveMonth: "2026-02", priorMonthlyContribution: 500, emergencyFloorMonths: 6,
      allocationInput: null, allowedTargets: ["emergency"], realityData: { monthly_contribution: 500 },
      recompute: okRecompute(0), sealPreview: {}, idempotencyKey: KEY,
    });
  };

  const rA = await runFor(uA);
  const rB = await runFor(uB); // SAME key, different user -> must succeed
  assert.ok(rA.commitment.id && rB.commitment.id && rA.commitment.id !== rB.commitment.id, "two users, same key -> two commitments");

  // same user + same key again -> the per-user unique index rejects it
  const { plan: planA2, branch: branchA2 } = await seed(store, pool, uA);
  await assert.rejects(
    atomic.sealAtomic({
      profileKey: uA, domain: "loan", planId: planA2.id, branchId: branchA2.id,
      monthlyAmount: 900, effectiveMonth: "2026-02", priorMonthlyContribution: 500, emergencyFloorMonths: 6,
      allocationInput: null, allowedTargets: ["emergency"], realityData: { monthly_contribution: 500 },
      recompute: okRecompute(0), sealPreview: {}, idempotencyKey: KEY,
    }),
    (e) => e.code === "SEAL_UNIQUE_VIOLATION",
  );
  const found = await atomic.findSealByIdempotencyKey(uA, KEY);
  assert.equal(found.id, rA.commitment.id, "the original commitment is recoverable by (user, key)");
});
