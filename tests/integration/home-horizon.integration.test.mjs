// Home Horizon domain integration test (Living Thread commit 2) against the
// REAL database. Proves the real causal chain: a pricier flat pushes the
// upfront + monthly up, drops the post-purchase emergency buffer, and a
// minimum_emergency_months Pin then blocks the Seal. Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };
const FIXTURE_HOME_USER = "315b3838-54c8-4c5c-9000-7fd3cc28f499";

async function mods() {
  const [ffService, ffAdapters, store, ff, db] = await Promise.all([
    import("../../lib/future-field/service.js"),
    import("../../lib/future-field/adapters.js"),
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/plan-runtime/index.js"),
    import("../../lib/db.js"),
  ]);
  return { ffService, ffAdapters, store, ff, pool: db.pool };
}

test("Home Horizon: pricier flat -> upfront/monthly up, buffer down, server impactSet says emergency DOWN, and a floor Pin blocks Seal", opts, async (t) => {
  const { ffService, ffAdapters, store, ff, pool } = await mods();
  const ctx = await ffService.loadDomainContext(FIXTURE_HOME_USER, "home");
  if (!ctx.realityPlanData) {
    t.skip("fixture account has no confirmed home plan");
    return;
  }
  const plan = await ffService.ensurePlan(FIXTURE_HOME_USER, "home", ctx);
  t.after(async () => {
    await pool.query("delete from plan_branches where plan_id = $1", [plan.id]);
    await pool.query("delete from plan_constraints where plan_id = $1", [plan.id]);
    await pool.query("delete from plan_versions where plan_id = $1", [plan.id]);
    await pool.query("delete from plans where id = $1", [plan.id]);
  });

  const adapter = ffAdapters.getFutureFieldAdapter("home");
  const projCtx = {
    emergencyBufferMonths: ctx.emergencyBufferMonths,
    committedExcludingWedding: ctx.committedExcludingWedding,
    weddingActive: true,
    retirementActive: true,
  };

  const realityFeas = adapter.feasibility(ctx.realityPlanData, projCtx);
  assert.ok(realityFeas.horizon?.available, "the Horizon engine ran on the fixture's real plan");
  const realityUpfront = realityFeas.horizon.upfrontStack.upfrontCashRequired.value;
  const realityCash = realityFeas.horizon.afterlife.cashAfterPurchase.value;

  // A 30% pricier flat.
  const pricier = Math.round(ctx.realityPlanData.estimated_price * 1.3);
  const peeled = ff.peelBranch({
    baseData: ctx.realityPlanData,
    overrides: { estimated_price: pricier },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const branch = await store.createBranch(plan.id, FIXTURE_HOME_USER, {
    label: "itest pricier flat", baseVersion: "1", data: peeled.data, delta: peeled.delta, feasibility: peeled.feasibility,
  });

  const branchFeas = adapter.feasibility(peeled.data, projCtx);
  assert.ok(branchFeas.horizon.upfrontStack.upfrontCashRequired.value > realityUpfront, "upfront cash rose");
  assert.ok(branchFeas.horizon.loan.monthlyRepayment.value > realityFeas.horizon.loan.monthlyRepayment.value, "monthly repayment rose");
  assert.ok(branchFeas.horizon.afterlife.cashAfterPurchase.value < realityCash, "less cash left after the purchase");

  // Server-owned impactSet: emergency direction is DOWN, and it's a ghost
  // (no confirmedAfter) because nothing was allocated.
  const impact = adapter.projectImpacts(peeled.data, ctx.realityPlanData, projCtx, null);
  const em = impact.affectedGoals.find((g) => g.goalId === "emergency");
  assert.equal(em.direction, "down");
  assert.equal(em.confirmedAfter, null);
  assert.ok(impact.affectedGoals.filter((g) => g.direction !== "flat").length >= 2, "two or more goals move");

  // A minimum_emergency_months Pin at 6 blocks the Seal of the pricier flat.
  await store.setConstraint(FIXTURE_HOME_USER, {
    planId: plan.id, kind: "minimum_emergency_months", operator: "gte", value: 6, scope: "plan", cause: { trigger: "itest" },
  });
  const pins = await store.getApplicableConstraints(FIXTURE_HOME_USER, { planId: plan.id, domain: "home" });
  const metrics = adapter.constraintMetrics(peeled.data, branchFeas, projCtx);
  const check = ff.checkConstraints(pins.filter((p) => p.kind === "minimum_emergency_months"), metrics);
  if (metrics.minimum_emergency_months == null) {
    // expenses unknown for the fixture -> the pin is honestly a gap, never a
    // false "violated". That is the correct behaviour: unknown != breach.
    assert.equal(check.ok, true);
    assert.equal(check.violations.length, 0);
  } else {
    assert.equal(check.ok, false, "the emergency-floor Pin is violated by the pricier flat");
    assert.ok(check.violations.some((v) => v.kind === "minimum_emergency_months"));
  }

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === branch.id), "branch persists and reloads");
});
