// Capital Prism domain integration test (Living Thread commit 7) against
// the REAL database with controlled reality data. Proves the causal chain:
// moving capital into the locked bands raises the required pace and drops
// liquid capital; the impactSet is ghost until allocated; a
// minimum_liquid_capital Pin can block the Seal; branches persist.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [ffAdapters, store, ff, db] = await Promise.all([
    import("../../lib/future-field/adapters.js"),
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/plan-runtime/index.js"),
    import("../../lib/db.js"),
  ]);
  return { ffAdapters, store, ff, pool: db.pool };
}

test("Capital Prism: more into locked bands -> less liquid capital + a server impactSet; liquid Pin blocks; branches persist", opts, async (t) => {
  const { ffAdapters, store, ff, pool } = await mods();
  const pk = `itest-prism-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_constraints where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "investment", goalKey: "investment", title: "investment" });
  const realityData = {
    jobs: { safety: 0, wedding: 0, home: 0, flexible: 1200, retirement: 0, longTerm: 800 },
    liquidity_gate_years: 3, target_pool: 200000, current_savings: 40000,
    credit_card_outstanding: 0, monthly_income: 7800, monthly_expenses: 3900,
  };
  await store.appendPlanVersion(plan.id, pk, { patch: realityData, cause: { trigger: "itest" }, actor: "system" });

  const adapter = ffAdapters.getFutureFieldAdapter("investment");
  const projCtx = { availableMonthlyCashflow: 2000, monthlyExpenses: 3900, emergencyBufferMonths: 10 };

  const rf = adapter.feasibility(realityData, projCtx);
  assert.ok(rf.prism?.available, "the Capital Prism engine ran");
  const baseLiquid = rf.prism.liquidKept.value;
  const baseYears = rf.prism.yearsToTarget;

  // Move capital into the locked bands (peel).
  const peeledLock = ff.peelBranch({
    baseData: realityData,
    overrides: { jobs: { safety: 0, wedding: 0, home: 0, flexible: 400, retirement: 0, longTerm: 1600 }, minimum_liquid_capital: 1000 },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const lockBranch = await store.createBranch(plan.id, pk, {
    label: "itest more locked", baseVersion: "1", data: peeledLock.data, delta: peeledLock.delta, feasibility: peeledLock.feasibility,
  });
  const lockFeas = adapter.feasibility(peeledLock.data, projCtx);
  assert.ok(lockFeas.prism.liquidKept.value < baseLiquid, "more locked -> less liquid capital");
  assert.ok(lockFeas.prism.yearsToTarget < baseYears, "more locked -> sooner to target");

  const impact = adapter.projectImpacts(peeledLock.data, realityData, projCtx, null);
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null));
  assert.ok(impact.resourceDelta.addedPressureMonthly > 0);

  // minimum_liquid_capital Pin above the branch's liquid kept -> block.
  const floor = Math.round((lockFeas.prism.liquidKept.value ?? 0) + 500);
  await store.setConstraint(pk, { planId: plan.id, kind: "minimum_liquid_capital", operator: "gte", value: floor, scope: "plan", cause: { trigger: "itest" } });
  const pins = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "investment" });
  const metrics = adapter.constraintMetrics(peeledLock.data, lockFeas, projCtx);
  const check = ff.checkConstraints(pins.filter((p) => p.kind === "minimum_liquid_capital"), metrics);
  if (metrics.minimum_liquid_capital == null) {
    assert.equal(check.ok, true, "unknown liquid capital -> honest gap");
  } else {
    assert.equal(check.ok, false, "liquid capital below the Pin -> Seal blocked");
    assert.ok(check.violations.some((v) => v.kind === "minimum_liquid_capital"));
  }

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === lockBranch.id), "branch persists + reload");
});
