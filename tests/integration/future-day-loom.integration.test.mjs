// Future-Day Loom domain integration test (Living Thread commit 5) against
// the REAL database with controlled reality data. Proves the causal chain:
// a richer Future Day raises the gap/contribution range; a bigger
// contribution drops current freedom; the impactSet keeps the range; a
// minimum_current_breathing_room Pin can block the Seal; branch persists.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [ffAdapters, store, ff, db, loom] = await Promise.all([
    import("../../lib/future-field/adapters.js"),
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/plan-runtime/index.js"),
    import("../../lib/db.js"),
    import("../../lib/retirement/future-day-finance.js"),
  ]);
  return { ffAdapters, store, ff, pool: db.pool, loom };
}

test("Future-Day Loom: richer day -> bigger gap/contribution range; bigger contribution -> less current freedom; floor Pin blocks; branch persists", opts, async (t) => {
  const { ffAdapters, store, ff, pool } = await mods();
  const pk = `itest-loom-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_constraints where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "retirement", goalKey: "retirement", title: "retirement" });
  const realityData = {
    target_monthly_income: 4200, gap_monthly: 2000, monthly_contribution: 500,
    current_savings: 30000, monthly_income: 7800, monthly_expenses: 3900,
    current_age: 42, future_age: 65,
  };
  await store.appendPlanVersion(plan.id, pk, { patch: realityData, cause: { trigger: "itest" }, actor: "system" });

  const adapter = ffAdapters.getFutureFieldAdapter("retirement");
  const projCtx = { emergencyBufferMonths: 6, otherGoalsMonthlyOutflow: 800 };

  const rf = adapter.feasibility(realityData, projCtx);
  assert.ok(rf.loom?.available, "the Future-Day Loom engine ran");
  const bareGap = rf.loom.gapMonthlyRange.expected;

  // A richer Future Day (peel with future_day choices).
  const richerDay = { where: "overseas_higher_cost", housing: "renting", routine: "active_social" };
  const peeledDay = ff.peelBranch({
    baseData: realityData,
    overrides: { future_day: richerDay },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const dayBranch = await store.createBranch(plan.id, pk, {
    label: "itest richer future day", baseVersion: "1", data: peeledDay.data, delta: peeledDay.delta, feasibility: peeledDay.feasibility,
  });
  const richFeas = adapter.feasibility(peeledDay.data, projCtx);
  assert.ok(richFeas.loom.gapMonthlyRange.expected > bareGap, "a richer Future Day raises the gap");
  assert.ok(richFeas.loom.requiredContributionRange.low < richFeas.loom.requiredContributionRange.high, "still a range, not a point");

  // A bigger contribution -> less current freedom + a server impactSet.
  const peeledContrib = ff.peelBranch({
    baseData: realityData,
    overrides: { monthly_contribution: 2200, minimum_current_breathing_room: 1200 },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const contribBranch = await store.createBranch(plan.id, pk, {
    label: "itest +contribution", baseVersion: "1", data: peeledContrib.data, delta: peeledContrib.delta, feasibility: peeledContrib.feasibility,
  });
  const contribFeas = adapter.feasibility(peeledContrib.data, projCtx);
  assert.ok(contribFeas.loom.currentBreathingRoomAfter.value < rf.loom.currentBreathingRoomAfter.value, "current freedom drops");

  const impact = adapter.projectImpacts(peeledContrib.data, realityData, projCtx, null);
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null));
  assert.ok(impact.resourceDelta.gapMonthlyRangeAfter && impact.resourceDelta.gapMonthlyRangeAfter.expected != null, "the impactSet carries the gap as a range");

  // minimum_current_breathing_room Pin above the branch's headroom -> block.
  const floor = Math.round((contribFeas.loom.currentBreathingRoomAfter.value ?? 0) + 600);
  await store.setConstraint(pk, { planId: plan.id, kind: "minimum_current_breathing_room", operator: "gte", value: floor, scope: "plan", cause: { trigger: "itest" } });
  const pins = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "retirement" });
  const metrics = adapter.constraintMetrics(peeledContrib.data, contribFeas, projCtx);
  const check = ff.checkConstraints(pins.filter((p) => p.kind === "minimum_current_breathing_room"), metrics);
  if (metrics.minimum_current_breathing_room == null) {
    assert.equal(check.ok, true, "unknown breathing room -> honest gap");
  } else {
    assert.equal(check.ok, false, "breathing room below the Pin -> Seal blocked");
    assert.ok(check.violations.some((v) => v.kind === "minimum_current_breathing_room"));
  }

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === dayBranch.id) && reloaded.some((b) => b.id === contribBranch.id), "branches persist + reload");
});
