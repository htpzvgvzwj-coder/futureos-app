// Calendar Orbit domain integration test (Living Thread commit 6) against
// the REAL database with controlled reality data. Proves the causal chain:
// a bigger trip raises the trip-cost range and the required monthly pace;
// a bigger contribution drops current freedom; the impactSet keeps the
// range; a minimum_current_breathing_room Pin can block the Seal; branches
// persist and reload.
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

test("Calendar Orbit: bigger trip -> bigger cost range + pace; bigger contribution -> less current freedom; floor Pin blocks; branches persist", opts, async (t) => {
  const { ffAdapters, store, ff, pool } = await mods();
  const pk = `itest-orbit-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_constraints where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "travel", goalKey: "travel", title: "travel" });
  const realityData = {
    destination_type: "regional", comfort_tier: "mid", travellers: 2, nights: 8,
    trip_month: "2027-06", monthly_contribution: 300, current_savings: 5000,
    monthly_income: 7800, monthly_expenses: 3900,
  };
  await store.appendPlanVersion(plan.id, pk, { patch: realityData, cause: { trigger: "itest" }, actor: "system" });

  const adapter = ffAdapters.getFutureFieldAdapter("travel");
  const projCtx = { emergencyBufferMonths: 6, committedMonthlyTotal: 800, currentSavings: 5000, now: new Date("2026-09-15T00:00:00Z") };

  const rf = adapter.feasibility(realityData, projCtx);
  assert.ok(rf.orbit?.available, "the Calendar Orbit engine ran");
  const baseCost = rf.orbit.tripCostRange.expected;
  const baseReq = rf.orbit.requiredMonthly;

  // A bigger trip (peel).
  const peeledBig = ff.peelBranch({
    baseData: realityData,
    overrides: { travellers: 4, nights: 16, comfort_tier: "premium" },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const bigBranch = await store.createBranch(plan.id, pk, {
    label: "itest bigger trip", baseVersion: "1", data: peeledBig.data, delta: peeledBig.delta, feasibility: peeledBig.feasibility,
  });
  const bigFeas = adapter.feasibility(peeledBig.data, projCtx);
  assert.ok(bigFeas.orbit.tripCostRange.expected > baseCost, "a bigger trip raises the cost range");
  assert.ok(bigFeas.orbit.requiredMonthly > baseReq, "a bigger trip raises the required monthly pace");
  assert.ok(bigFeas.orbit.tripCostRange.low < bigFeas.orbit.tripCostRange.high, "still a range, not a point");

  // A bigger contribution -> less current freedom + a server impactSet.
  const peeledContrib = ff.peelBranch({
    baseData: realityData,
    overrides: { monthly_contribution: 3000, minimum_current_breathing_room: 1500 },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const contribBranch = await store.createBranch(plan.id, pk, {
    label: "itest +contribution", baseVersion: "1", data: peeledContrib.data, delta: peeledContrib.delta, feasibility: peeledContrib.feasibility,
  });
  const contribFeas = adapter.feasibility(peeledContrib.data, projCtx);
  assert.ok(contribFeas.orbit.currentBreathingRoomAfter.value < rf.orbit.currentBreathingRoomAfter.value, "current freedom drops");

  const impact = adapter.projectImpacts(peeledContrib.data, realityData, projCtx, null);
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null));
  assert.ok(impact.resourceDelta.tripCostRangeAfter && impact.resourceDelta.tripCostRangeAfter.expected != null, "the impactSet carries the trip cost as a range");

  // minimum_current_breathing_room Pin above the branch's headroom -> block.
  const floor = Math.round((contribFeas.orbit.currentBreathingRoomAfter.value ?? 0) + 600);
  await store.setConstraint(pk, { planId: plan.id, kind: "minimum_current_breathing_room", operator: "gte", value: floor, scope: "plan", cause: { trigger: "itest" } });
  const pins = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "travel" });
  const metrics = adapter.constraintMetrics(peeledContrib.data, contribFeas, projCtx);
  const check = ff.checkConstraints(pins.filter((p) => p.kind === "minimum_current_breathing_room"), metrics);
  if (metrics.minimum_current_breathing_room == null) {
    assert.equal(check.ok, true, "unknown breathing room -> honest gap");
  } else {
    assert.equal(check.ok, false, "breathing room below the Pin -> Seal blocked");
    assert.ok(check.violations.some((v) => v.kind === "minimum_current_breathing_room"));
  }

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === bigBranch.id) && reloaded.some((b) => b.id === contribBranch.id), "branches persist + reload");
});
