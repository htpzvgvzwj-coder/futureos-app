// Safety Runway domain integration test (Living Thread commit 3) against
// the REAL database. Uses controlled reality data (known expenses +
// savings) so it runs on any DB, and exercises real plan / branch /
// constraint persistence + the real finance + cross-goal engines.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [ffAdapters, store, ff, db, runway] = await Promise.all([
    import("../../lib/future-field/adapters.js"),
    import("../../lib/plan-runtime/store.js"),
    import("../../lib/plan-runtime/index.js"),
    import("../../lib/db.js"),
    import("../../lib/emergency/runway-finance.js"),
  ]);
  return { ffAdapters, store, ff, pool: db.pool, runway };
}

test("Safety Runway: bigger target -> bigger rebuild; impactSet tightens goals as ghosts; floor Pin blocks; rehearsal is pure; branch persists", opts, async (t) => {
  const { ffAdapters, store, ff, pool, runway } = await mods();
  const pk = `itest-runway-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_constraints where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "emergency", goalKey: "emergency", title: "emergency" });
  const realityData = { monthly_expenses: 4200, current_savings: 24000, target_months: 6, floor_months: 3, monthly_contribution: 300 };
  await store.appendPlanVersion(plan.id, pk, { patch: realityData, cause: { trigger: "itest" }, actor: "system" });

  const adapter = ffAdapters.getFutureFieldAdapter("emergency");
  const commitments = [
    { id: "loan:home", domain: "loan", label: "Home loan", monthlyAmount: 1500, essential: true },
    { id: "c:wed", domain: "wedding", label: "Wedding", monthlyAmount: 600, essential: false },
  ];
  const projCtx = { commitments };

  const realityFeas = adapter.feasibility(realityData, projCtx);
  assert.ok(realityFeas.runway?.available, "runway engine ran on controlled real expenses");
  assert.ok(realityFeas.runway.currentRunwayMonths > 0);

  // Bigger target -> the required monthly rebuild rises.
  const r6 = runway.requiredRebuildForTarget({ runway: realityFeas.runway, targetMonths: 6, byMonths: 24 });
  const bigFeas = adapter.feasibility({ ...realityData, target_months: 12 }, projCtx);
  const r12 = runway.requiredRebuildForTarget({ runway: bigFeas.runway, targetMonths: 12, byMonths: 24 });
  assert.ok(r12 > r6, `rebuild for 12mo (${r12}) > 6mo (${r6})`);

  // A branch that raises the monthly rebuild -> server impactSet tightens
  // the other goals; they stay ghosts (no confirmedAfter, no auto-alloc).
  const peeled = ff.peelBranch({
    baseData: realityData,
    overrides: { monthly_contribution: 900 },
    feasibilityFn: (d) => adapter.feasibility(d, projCtx),
  });
  const branch = await store.createBranch(plan.id, pk, {
    label: "itest bigger rebuild", baseVersion: "1", data: peeled.data, delta: peeled.delta, feasibility: peeled.feasibility,
  });
  const impact = adapter.projectImpacts(peeled.data, realityData, projCtx, null);
  assert.ok(impact.affectedGoals.length >= 2);
  assert.ok(impact.affectedGoals.every((g) => g.direction === "down" && g.confirmedAfter == null));
  assert.equal(impact.allocationRequired, true);
  // once a leg is allocated it becomes solid
  const placed = adapter.projectImpacts(peeled.data, realityData, projCtx, { flexibleMonthly: 300 });
  assert.notEqual(placed.affectedGoals[0].confirmedAfter, null);

  // minimum_floor_months Pin at 6, evaluated against the branch's real runway.
  await store.setConstraint(pk, { planId: plan.id, kind: "minimum_floor_months", operator: "gte", value: 6, scope: "plan", cause: { trigger: "itest" } });
  const pins = await store.getApplicableConstraints(pk, { planId: plan.id, domain: "emergency" });
  const metrics = adapter.constraintMetrics(peeled.data, adapter.feasibility(peeled.data, projCtx), projCtx);
  const check = ff.checkConstraints(pins.filter((p) => p.kind === "minimum_floor_months"), metrics);
  // controlled data: 24000 / (0.75*4200 + 1500) ~= 5.2 months current runway -> below the floor Pin
  assert.equal(check.ok, false, "runway below the floor Pin -> Seal blocked");
  assert.ok(check.violations.some((v) => v.kind === "minimum_floor_months"));

  // A rehearsal against these real numbers never touches the plan.
  const planCopy = { ...realityData };
  const reh = runway.rehearseShock({ runway: realityFeas.runway, shock: { incomeInterruptionMonths: 4, temporaryMonthlyExpense: 0, incomeRecoveryRatio: 1, monthlyIncome: 6800 } });
  assert.deepEqual(planCopy, realityData, "rehearsal did not mutate the plan");
  assert.ok(["holds", "dips_then_recovers", "needs_a_choice"].includes(reh.verdict));

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === branch.id), "branch persists + reloads");
});
