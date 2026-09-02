// Integration tests for PR #13 (One Life Thread) against the REAL database.
// Run: npm run test:integration
// Skipped (not failed) when DATABASE_URL is absent.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [db, atomic, store, cl] = await Promise.all([
    import("../../lib/db.js"),
    import("../../lib/plan-runtime/atomic-seal.js"),
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/change-ledger/store.js"),
  ]);
  return { pool: db.pool, withTransaction: db.withTransaction, query: db.query, atomic, store, cl };
}

async function cleanup(pool, pk) {
  await pool.query("delete from guardian_policies where profile_key = $1", [pk]);
  await pool.query("delete from goal_commitments where profile_key = $1", [pk]);
  await pool.query("delete from change_ledger_events where profile_key = $1", [pk]);
  const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
  for (const { id } of plans.rows) {
    await pool.query("delete from plan_branches where plan_id = $1", [id]);
    await pool.query("delete from plan_versions where plan_id = $1", [id]);
    await pool.query("delete from plan_transitions where from_plan_id = $1 or to_plan_id = $1", [id]);
  }
  await pool.query("delete from plans where profile_key = $1", [pk]);
}

async function seedPlanWithBranch(store, pool, pk, domain) {
  const plan = await store.getOrCreatePlan(pk, { domain, goalKey: domain, title: domain });
  await store.appendPlanVersion(plan.id, pk, { patch: { monthly_contribution: 500 }, cause: { trigger: "itest_seed" }, actor: "system" });
  const cur = await store.getCurrentPlanVersion(plan.id);
  const branch = await store.createBranch(plan.id, pk, {
    label: "itest branch",
    baseVersion: cur?.version ?? "0",
    data: { monthly_contribution: 900 },
    delta: { changedKeys: ["monthly_contribution"], before: { monthly_contribution: 500 }, after: { monthly_contribution: 900 } },
    feasibility: { available: true, sealable: true, sealableReason: "ok" },
  });
  return { plan, branch };
}

test("withTransaction rolls the whole thing back on any throw", opts, async (t) => {
  const { pool, withTransaction } = await mods();
  const pk = `itest-tx-${Date.now()}`;
  t.after(() => cleanup(pool, pk));

  await assert.rejects(
    withTransaction(async (tx) => {
      await tx.query(
        `insert into goal_commitments (profile_key, domain, monthly_contribution, effective_month, pause_if_emergency_months_below, source_moment)
         values ($1,'loan',700,'2026-02',6,'{}'::jsonb)`,
        [pk],
      );
      throw new Error("boom after the insert");
    }),
    /boom/,
  );

  const { rows } = await pool.query("select count(*)::int as n from goal_commitments where profile_key = $1", [pk]);
  assert.equal(rows[0].n, 0, "the insert before the throw did NOT persist");
});

test("sealAtomic: a validation failure inside the transaction leaves NO commitment / policy / events", opts, async (t) => {
  const { pool, atomic, store } = await mods();
  const pk = `itest-seal-fail-${Date.now()}`;
  t.after(() => cleanup(pool, pk));

  const { plan } = await seedPlanWithBranch(store, pool, pk, "loan");

  // Pass a branchId that does NOT belong to this profile -> the FOR UPDATE
  // ownership check throws BRANCH_NOT_FOUND, rolling everything back.
  await assert.rejects(
    atomic.sealAtomic({
      profileKey: pk,
      domain: "loan",
      planId: plan.id,
      branchId: "00000000-0000-0000-0000-000000000000",
      monthlyAmount: 900,
      effectiveMonth: "2026-02",
      priorMonthlyContribution: 500,
      emergencyFloorMonths: 6,
      allocationInput: null,
      allowedTargets: ["emergency"],
      realityData: { monthly_contribution: 500 },
      recompute: () => ({ feasibility: { sealable: true }, constraintCheck: { ok: true }, serverFreed: 0, serverAddedPressure: 0 }),
      sealPreview: { execution: "shadow_only" },
      idempotencyKey: "itest-fail-key",
    }),
    /branch_not_found/i,
  );

  const c = await pool.query("select count(*)::int n from goal_commitments where profile_key = $1", [pk]);
  const g = await pool.query("select count(*)::int n from guardian_policies where profile_key = $1", [pk]);
  const e = await pool.query("select count(*)::int n from change_ledger_events where profile_key = $1", [pk]);
  assert.equal(c.rows[0].n, 0, "no commitment");
  assert.equal(g.rows[0].n, 0, "no guardian policy");
  assert.equal(e.rows[0].n, 0, "no ledger events");
});

test("sealAtomic: a successful seal writes commitment + policy + 2 ledger events atomically; identity recovers on remount", opts, async (t) => {
  const { pool, atomic, store } = await mods();
  const pk = `itest-seal-ok-${Date.now()}`;
  t.after(() => cleanup(pool, pk));

  const { plan, branch } = await seedPlanWithBranch(store, pool, pk, "loan");

  const res = await atomic.sealAtomic({
    profileKey: pk,
    domain: "loan",
    planId: plan.id,
    branchId: branch.id,
    monthlyAmount: 900,
    effectiveMonth: "2026-02",
    readyMonth: "2029-06",
    priorMonthlyContribution: 500,
    emergencyFloorMonths: 6,
    allocationInput: { emergencyMonthly: 100 },
    allocationTargetGoalId: "emergency",
    allowedTargets: ["emergency", "home"],
    realityData: { monthly_contribution: 500 },
    // the authoritative recompute: server truth, freed=100 so the
    // emergency allocation validates.
    recompute: () => ({ feasibility: { sealable: true }, constraintCheck: { ok: true }, serverFreed: 100, serverAddedPressure: 0 }),
    sealPreview: { execution: "shadow_only" },
    idempotencyKey: "itest-ok-key-1",
  });
  assert.ok(res.commitment?.id, "commitment created");
  assert.equal(res.ledgerEventIds.length, 2, "sealed + commitment_created events");

  const g = await pool.query("select count(*)::int n from guardian_policies where profile_key = $1 and commitment_id = $2 and active = true", [pk, res.commitment.id]);
  assert.equal(g.rows[0].n, 1, "one active guardian policy for the commitment");

  const br = await pool.query("select status, sealed_commitment_id from plan_branches where id = $1", [branch.id]);
  assert.equal(br.rows[0].status, "sealed");
  assert.equal(String(br.rows[0].sealed_commitment_id), String(res.commitment.id));

  const pl = await pool.query("select state from plans where id = $1", [plan.id]);
  assert.equal(pl.rows[0].state, "scheduled");

  // Remount recovery: the identity query the /api/future-field route runs
  // finds THIS scene's seal - same domain + same plan.
  const identity = await pool.query(
    `select id, domain, plan_id, plan_branch_id, source_moment from goal_commitments
     where profile_key = $1 and domain = $2 and plan_id = $3 and status = 'active' order by created_at desc limit 1`,
    [pk, "loan", plan.id],
  );
  assert.equal(identity.rows.length, 1);
  assert.equal(String(identity.rows[0].plan_id), String(plan.id));
  assert.equal(String(identity.rows[0].plan_branch_id), String(branch.id));
  assert.equal(identity.rows[0].source_moment.allocationTargetGoalId, "emergency");

  // A DIFFERENT plan's commitment must NOT be mistaken for this scene's seal.
  const other = await pool.query(
    `select id from goal_commitments where profile_key = $1 and domain = 'retirement' and plan_id = $2 and status = 'active'`,
    [pk, plan.id],
  );
  assert.equal(other.rows.length, 0, "no cross-domain false positive");

  // findSealByIdempotencyKey returns the same row for a retry.
  const again = await atomic.findSealByIdempotencyKey(pk, "itest-ok-key-1");
  assert.equal(String(again.id), String(res.commitment.id), "idempotent retry -> same commitment");
});

test("buildLifeThread: a demo/default profile is reported as unknown, not as numbers", opts, async (t) => {
  const { pool } = await mods();
  const { buildLifeThread } = await import("../../lib/life-thread/service.js");
  const pk = crypto.randomUUID(); // user_preferences.user_id is uuid-typed
  t.after(() => cleanup(pool, pk));

  // No saved profile row at all -> every stated figure must be unknown.
  const thread = await buildLifeThread(pk);
  assert.ok(thread.snapshotVersion, "has a snapshot version");
  assert.equal(thread.bankNow.known, false);
  assert.equal(thread.bankNow.availableBalance, null);
  assert.equal(thread.provenance.bankNow, "unknown");
  assert.equal(thread.availableMonthlyCashflow, null);
  assert.ok(Array.isArray(thread.lifeNodes) && thread.lifeNodes.length === 6);
  assert.ok(thread.lifeNodes.every((n) => ["calm", "moving", "waiting_decision", "unknown"].includes(n.state)));
});
