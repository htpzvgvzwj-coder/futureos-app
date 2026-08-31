// Wedding Studio - unified impactSet alignment integration test (Living
// Thread commit 10) against the REAL database with controlled reality
// data. Proves: fewer guests frees the user's monthly need as a server
// impactSet (ghost until allocated); a bigger wedding is named pressure;
// branches persist.
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

test("Wedding thread: fewer guests -> freed monthly (ghost); a bigger wedding -> named pressure; branches persist", opts, async (t) => {
  const { ffAdapters, store, ff, pool } = await mods();
  const pk = `itest-wedthread-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "wedding", goalKey: "wedding", title: "wedding" });
  const realityData = {
    wedding_date: "2027-06", guest_count: 150, venue_tier: "mid_range", venue_type: "hotel",
    photography_tier: "mid", attire_tier: "mid", total_budget: null,
    monthly_contribution: 800, partner_contribution: 400, current_savings: 6000,
  };
  await store.appendPlanVersion(plan.id, pk, { patch: realityData, cause: { trigger: "itest" }, actor: "system" });

  const adapter = ffAdapters.getFutureFieldAdapter("wedding");
  const projCtx = { monthlyIncome: 8000, monthlyExpenses: 3800, committedExcludingWedding: 900 };

  const smallerPeel = ff.peelBranch({ baseData: realityData, overrides: { guest_count: 80 }, feasibilityFn: (d) => adapter.feasibility(d) });
  const smallerBranch = await store.createBranch(plan.id, pk, {
    label: "itest fewer guests", baseVersion: "1", data: smallerPeel.data, delta: smallerPeel.delta, feasibility: smallerPeel.feasibility,
  });
  const smallerImpact = adapter.projectImpacts(smallerPeel.data, realityData, projCtx, null);
  assert.ok(smallerImpact.resourceDelta.freedMonthly > 0, "fewer guests frees the user's monthly need");
  assert.equal(smallerImpact.resourceDelta.addedPressureMonthly, 0);
  assert.ok(smallerImpact.affectedGoals.every((g) => g.confirmedAfter == null), "ghost until allocated");

  const biggerPeel = ff.peelBranch({ baseData: realityData, overrides: { guest_count: 240, venue_tier: "premium" }, feasibilityFn: (d) => adapter.feasibility(d) });
  const biggerBranch = await store.createBranch(plan.id, pk, {
    label: "itest bigger wedding", baseVersion: "1", data: biggerPeel.data, delta: biggerPeel.delta, feasibility: biggerPeel.feasibility,
  });
  const biggerImpact = adapter.projectImpacts(biggerPeel.data, realityData, projCtx, null);
  assert.ok(biggerImpact.resourceDelta.addedPressureMonthly > 0, "a bigger wedding is monthly pressure");
  assert.ok(biggerImpact.affectedGoals.filter((g) => g.direction === "down").length >= 2);

  const reloaded = await store.listBranches(plan.id);
  assert.ok(reloaded.some((b) => b.id === smallerBranch.id) && reloaded.some((b) => b.id === biggerBranch.id), "branches persist + reload");
});
