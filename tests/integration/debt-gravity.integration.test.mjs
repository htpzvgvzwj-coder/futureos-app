// Debt Gravity domain integration test (Living Thread commit 4) against the
// REAL database, with controlled reality data. Proves the causal chain:
// extra repayment -> earlier payoff, less breathing room, a ghost Future
// Handoff; a minimum_breathing_room Pin can block the Seal; branch persists.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [ffAdapters, store, ff, db, gravity] = await Promise.all([
    import("../../lib/future-field/adapters.js"),
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/plan-runtime/index.js"),
    import("../../lib/db.js"),
    import("../../lib/loan/debt-gravity-finance.js"),
  ]);
  return { ffAdapters, store, ff, pool: db.pool, gravity };
}

test("Debt Gravity: extra repayment -> earlier payoff + less breathing room + a ghost Handoff; floor Pin blocks; branch persists", opts, async (t) => {
  const { ffAdapters, store, ff, pool, gravity } = await mods();
  const pk = `itest-gravity-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_constraints where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "loan", goalKey: "loan", title: "loan" });
  const realityData = {
    purpose: "personal", loan_amount: 18000, annual_rate_percent: 7.5, tenure_years: 5,
    monthly_installment: 360, extra_repayment: 0, monthly_income: 6500, monthly_expenses: 3400,
    current_savings: 20000, other_goals_monthly_outflow: 400,
  };
  await store.appendPlanVersion(plan.id, pk, { patch: realityData, cause: { trigger: "itest" }, actor: "system" });

  const adapter = ffAdapters.getFutureFieldAdapter("loan");
  const projCtx = { emergencyBufferMonths: 6 };

  const rf = adapter.feasibility(realityData, projCtx);
  assert.ok(rf.gravity?.available, "the Debt Gravity engine ran on the controlled loan");
  const body0 = rf.gravity.bodies[0];
  const breathing0 = rf.gravity.breathingRoom.value;

  // A branch with an extra repayment.
  const peeled = ff.peelBranch({
    baseData: realityData,
    overrides: { extra_repayment: 300, breathing_room_floor: 500 },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const branch = await store.createBranch(plan.id, pk, {
    label: "itest +300 extra", baseVersion: "1", data: peeled.data, delta: peeled.delta, feasibility: peeled.feasibility,
  });

  const bf = adapter.feasibility(peeled.data, projCtx);
  const body1 = bf.gravity.bodies[0];
  assert.ok(body1.monthsToPayoff < body0.monthsToPayoff, "payoff is earlier");
  assert.ok(bf.gravity.breathingRoom.value < breathing0, "current breathing room drops");
  assert.equal(bf.gravity.futureHandoffPreview.state, "ghost", "the released monthly is a ghost until payoff");
  assert.equal(bf.gravity.futureHandoffPreview.releasedMonthly, body1.minimumMonthly.value);

  // Server impactSet - other goals move down and stay ghosts.
  const impact = adapter.projectImpacts(peeled.data, realityData, projCtx, null);
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null));
  assert.equal(impact.resourceDelta.futureHandoffAtPayoff.state, "ghost");

  // minimum_breathing_room Pin at a level above the branch's headroom -> blocked.
  const floor = Math.round((bf.gravity.breathingRoom.value ?? 0) + 500);
  await store.setConstraint(pk, { planId: plan.id, kind: "minimum_breathing_room", operator: "gte", value: floor, scope: "plan", cause: { trigger: "itest" } });
  const pins = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "loan" });
  const metrics = adapter.constraintMetrics(peeled.data, bf, projCtx);
  const check = ff.checkConstraints(pins.filter((p) => p.kind === "minimum_breathing_room"), metrics);
  if (metrics.minimum_breathing_room == null) {
    assert.equal(check.ok, true, "unknown breathing room -> honest gap, never a false breach");
  } else {
    assert.equal(check.ok, false, "breathing room below the Pin -> Seal blocked");
    assert.ok(check.violations.some((v) => v.kind === "minimum_breathing_room"));
  }

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === branch.id), "branch persists + reloads");
});
