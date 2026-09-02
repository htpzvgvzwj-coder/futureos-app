// Blocker 3 - branch activation is one atomic DB operation and the
// partial unique index guarantees at most one active branch per plan.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [store, db] = await Promise.all([import("../../lib/plan-runtime/store.js"), import("../../lib/db.js")]);
  return { store, pool: db.pool };
}

test("plan_branches_one_active_per_plan + setActiveBranchAtomic: at most one active branch, even under concurrency", opts, async (t) => {
  const { store, pool } = await mods();
  const pk = `itest-activate-${Date.now()}`;
  t.after(async () => {
    const plans = await pool.query("select id from plans where profile_key = $1", [pk]);
    for (const { id } of plans.rows) {
      await pool.query("delete from plan_branches where plan_id = $1", [id]);
      await pool.query("delete from plan_versions where plan_id = $1", [id]);
    }
    await pool.query("delete from plans where profile_key = $1", [pk]);
  });

  const plan = await store.getOrCreatePlan(pk, { domain: "home", goalKey: "home", title: "home" });
  await store.appendPlanVersion(plan.id, pk, { patch: { estimated_price: 500000 }, cause: { trigger: "itest" }, actor: "system" });

  const a = await store.createBranch(plan.id, pk, { label: "A", baseVersion: "1", data: { estimated_price: 520000 } });
  const b = await store.createBranch(plan.id, pk, { label: "B", baseVersion: "1", data: { estimated_price: 560000 } });
  const c = await store.createBranch(plan.id, pk, { label: "C", baseVersion: "1", data: { estimated_price: 480000 } });

  const activeCount = async () =>
    Number((await pool.query("select count(*)::int c from plan_branches where plan_id = $1 and status = 'active'", [plan.id])).rows[0].c);

  // 1) plain activate -> exactly one active
  await store.setActiveBranchAtomic(plan.id, a.id, pk);
  assert.equal(await activeCount(), 1);
  const rowA = await pool.query("select status from plan_branches where id = $1", [a.id]);
  assert.equal(rowA.rows[0].status, "active");

  // 2) switching to B demotes A atomically -> still exactly one
  await store.setActiveBranchAtomic(plan.id, b.id, pk);
  assert.equal(await activeCount(), 1);
  assert.equal((await pool.query("select status from plan_branches where id = $1", [a.id])).rows[0].status, "open");

  // 3) the raw index rejects a second active
  await assert.rejects(
    pool.query("update plan_branches set status = 'active' where id = $1", [c.id]),
    (e) => e.code === "23505",
  );
  assert.equal(await activeCount(), 1);

  // 4) two concurrent activations for different branches -> DB still holds one
  const results = await Promise.allSettled([
    store.setActiveBranchAtomic(plan.id, a.id, pk),
    store.setActiveBranchAtomic(plan.id, c.id, pk),
  ]);
  assert.ok(results.some((r) => r.status === "fulfilled"), "at least one activation succeeded");
  assert.equal(await activeCount(), 1, "the DB never ends with two active branches");

  // 5) a sealed/discarded branch cannot be activated
  await store.updateBranch(c.id, pk, { status: "discarded" });
  await assert.rejects(store.setActiveBranchAtomic(plan.id, c.id, pk), (e) => e.code === "BRANCH_NOT_ACTIVATABLE");

  // 6) branchId null deactivates all
  await store.setActiveBranchAtomic(plan.id, null, pk);
  assert.equal(await activeCount(), 0);
});
