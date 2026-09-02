// Living Envelope domain integration test (Living Thread commit 8) against
// the REAL database with controlled reality data. Proves the causal chain:
// stretching the membrane to close an exposure raises the premium and
// shrinks the known exposure; the impactSet is ghost until allocated; a
// minimum_current_breathing_room Pin can block the Seal; branches persist.
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

test("Living Envelope: stretch cover -> premium up + exposure down + a server impactSet; floor Pin blocks; branches persist", opts, async (t) => {
  const { ffAdapters, store, ff, pool } = await mods();
  const pk = `itest-envelope-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_constraints where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "insurance", goalKey: "insurance", title: "insurance" });
  const realityData = {
    monthly_expenses: 4200, income_protection_months: 12,
    existing_income_protection: 20000,
    home_loan_outstanding: 320000, existing_life_cover: 120000,
    dependents: 0, annual_care_cost: 12000, existing_ci_cover: 36000, care_years: 3,
    monthly_premium_now: 70, monthly_income: 8200,
  };
  await store.appendPlanVersion(plan.id, pk, { patch: realityData, cause: { trigger: "itest" }, actor: "system" });

  const adapter = ffAdapters.getFutureFieldAdapter("insurance");
  const projCtx = { monthlyIncome: 8200, monthlyExpenses: 4200, committedExcludingDomain: 900, emergencyBufferMonths: 6 };

  const rf = adapter.feasibility(realityData, projCtx);
  assert.ok(rf.envelope?.available, "the Living Envelope engine ran");
  const baseExposure = rf.envelope.knownExposure;
  const basePremium = rf.envelope.premiumAfter.value;
  assert.ok(baseExposure > 0, "there is a real known exposure");

  // Stretch the membrane (peel).
  const peeled = ff.peelBranch({
    baseData: realityData,
    overrides: { desired_cover: { income: 50400, home_loan: 320000 }, minimum_current_breathing_room: 3200 },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const branch = await store.createBranch(plan.id, pk, {
    label: "itest stretch cover", baseVersion: "1", data: peeled.data, delta: peeled.delta, feasibility: peeled.feasibility,
  });
  const stretchFeas = adapter.feasibility(peeled.data, projCtx);
  assert.ok(stretchFeas.envelope.knownExposure < baseExposure, "stretching cover shrinks the exposure");
  assert.ok(stretchFeas.envelope.premiumAfter.value > basePremium, "stretching cover costs premium");

  const impact = adapter.projectImpacts(peeled.data, realityData, projCtx, null);
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null));
  assert.ok(impact.resourceDelta.knownExposureAfter < impact.resourceDelta.knownExposureBefore);

  // minimum_current_breathing_room Pin above the branch's headroom -> block.
  const floor = Math.round((stretchFeas.envelope.currentBreathingRoomAfter.value ?? 0) + 600);
  await store.setConstraint(pk, { planId: plan.id, kind: "minimum_current_breathing_room", operator: "gte", value: floor, scope: "plan", cause: { trigger: "itest" } });
  const pins = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "insurance" });
  const metrics = adapter.constraintMetrics(peeled.data, stretchFeas, projCtx);
  const check = ff.checkConstraints(pins.filter((p) => p.kind === "minimum_current_breathing_room"), metrics);
  if (metrics.minimum_current_breathing_room == null) {
    assert.equal(check.ok, true, "unknown breathing room -> honest gap");
  } else {
    assert.equal(check.ok, false, "breathing room below the Pin -> Seal blocked");
    assert.ok(check.violations.some((v) => v.kind === "minimum_current_breathing_room"));
  }

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === branch.id), "branch persists + reload");
});
