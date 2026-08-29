// End-to-end Future Field smoke test against the real Neon DB.
// Exercises the service + plan-runtime stores + pure solvers for a real
// user that has a confirmed home plan, then deletes every row it created.
import { loadDomainContext, ensurePlan } from "./lib/future-field/service.js";
import { planStore, peelBranch, solveMonthlyForTargetMonths, checkConstraints, buildSealPreview } from "./lib/plan-runtime/index.js";
import { getFutureFieldAdapter } from "./lib/future-field/adapters.js";
import { pool } from "./lib/db.js";

const PK = "315b3838-54c8-4c5c-9000-7fd3cc28f499"; // karina@demo.futureos - has a confirmed home plan
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  ok  " + n); } else { fail++; console.log("  FAIL " + n + " " + x); } };

let planId = null;
try {
  // 1. reality context
  const ctx = await loadDomainContext(PK, "home");
  ok("loadDomainContext returns a reality plan", !!ctx.realityPlanData, JSON.stringify(ctx.realityPlanData ?? null));
  ok("reality has a price + down payment target", ctx.realityPlanData.estimated_price > 0 && ctx.realityPlanData.down_payment_needed > 0);
  ok("adapter registered for home", !!ctx.adapter);

  const feas = ctx.adapter.feasibility(ctx.realityPlanData);
  ok("real feasibility computed (monthly installment)", feas.available && feas.monthly_installment > 0, JSON.stringify(feas).slice(0, 120));

  // 2. plan row + seeded v1
  const plan = await ensurePlan(PK, "home", ctx);
  planId = plan.id;
  ok("plan row created/exists", !!plan.id && plan.domain === "home");
  const v1 = await planStore.getCurrentPlanVersion(plan.id);
  ok("v1 seeded from confirmed plan", v1?.version === "1" && Number(v1.data.estimated_price) === Number(ctx.realityPlanData.estimated_price));

  // 3. Peel
  const cheaper = { ...ctx.realityPlanData, estimated_price: Math.round(ctx.realityPlanData.estimated_price * 0.9) };
  const peeled = peelBranch({ baseData: ctx.realityPlanData, overrides: { estimated_price: cheaper.estimated_price }, feasibilityFn: (d) => ctx.adapter.feasibility(d) });
  ok("peel delta isolates the one changed field", peeled.delta.changedKeys.join() === "estimated_price");
  ok("peel recomputes real feasibility", peeled.feasibility.monthly_installment > 0 && peeled.feasibility.monthly_installment < feas.monthly_installment);
  const branch = await planStore.createBranch(plan.id, PK, { label: "smoke cheaper flat", baseVersion: "1", data: peeled.data, delta: peeled.delta, feasibility: peeled.feasibility });
  ok("branch row written", !!branch.id);
  const branchList = await planStore.listBranches(plan.id);
  ok("listBranches returns it", branchList.some((b) => b.id === branch.id));

  // 4. Bend - reverse-solve a monthly amount for a moved date
  const projector = ctx.adapter.projector(ctx.realityPlanData);
  const currentMonths = projector(ctx.realityPlanData.monthly_contribution || 500);
  ok("projector gives a months-to-ready for the current amount", currentMonths == null || currentMonths > 0, String(currentMonths));
  const target = Math.max(6, Math.round((currentMonths ?? 60) * 0.6));
  const solved = solveMonthlyForTargetMonths({ targetMonths: target, projectMonthsFn: projector, highAmount: Math.max(20000, (ctx.availableMonthlyCashflow ?? 5000) * 3) });
  ok("bend solves a monthly amount (or honestly says not achievable)", solved.achievable ? solved.amount > 0 : solved.achievable === false, JSON.stringify(solved));
  if (solved.achievable) ok("solved pace actually reaches the target", solved.projectedMonths <= target);

  // 5. Pin
  const pin = await planStore.setConstraint(PK, { planId: plan.id, kind: "emergency_floor_months", operator: "gte", value: 6, scope: "domain", cause: { trigger: "smoke" } });
  ok("pin row written", !!pin.id && pin.active === true);
  const applicable = await planStore.getApplicableConstraints(PK, { planId: plan.id, domain: "home" });
  ok("getApplicableConstraints returns the pin", applicable.some((c) => c.id === pin.id));
  const check = checkConstraints(
    [{ kind: "emergency_floor_months", operator: "gte", value: 6 }],
    { emergency_floor_months: ctx.emergencyBufferMonths },
  );
  ok("checkConstraints evaluates against the real buffer", typeof check.ok === "boolean", `buffer=${ctx.emergencyBufferMonths} ok=${check.ok}`);

  // 6. Seal preview (pure, no write)
  const preview = buildSealPreview({
    branch: { label: branch.label, feasibility: peeled.feasibility },
    planDomain: "home",
    monthlyAmount: 1200,
    effectiveMonth: "2026-10",
    readyMonth: "2030-06",
    constraintCheck: check,
    isShadowOnly: true,
  });
  ok("seal preview states execution honesty", preview.execution === "shadow_only" && preview.reversible === true);
  ok("seal preview carries pin compliance", typeof preview.respectsPins === "boolean");

  await planStore.releaseConstraint(pin.id, PK);
  const afterRelease = await planStore.getApplicableConstraints(PK, { planId: plan.id, domain: "home" });
  ok("released pin no longer applicable", !afterRelease.some((c) => c.id === pin.id));

  console.log("\n--- reality feasibility sample ---");
  console.log(`price ${ctx.realityPlanData.estimated_price}  installment ${feas.monthly_installment}/mo  within affordability: ${feas.within_affordability}`);
  if (solved.achievable) console.log(`bend: reach in ${target} months -> ${solved.amount}/mo`);
} finally {
  if (planId) {
    await pool.query("delete from plan_branches where plan_id = $1", [planId]);
    await pool.query("delete from plan_constraints where plan_id = $1", [planId]);
    await pool.query("delete from plan_versions where plan_id = $1", [planId]);
    const d = await pool.query("delete from plans where id = $1", [planId]);
    console.log(`\ncleanup: removed plan ${planId} (${d.rowCount} row) + its branches/versions/constraints`);
  }
  await pool.end();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
