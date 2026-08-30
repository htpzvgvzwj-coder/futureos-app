import test from "node:test";
import assert from "node:assert/strict";
import { getFutureFieldAdapter, futureFieldSupportedDomains } from "../lib/future-field/adapters.js";
import { peelBranch, solveMonthlyForTargetMonths, checkConstraints } from "../lib/plan-runtime/index.js";
import { getLivingPlanSpec, registeredLivingPlanDomains, isLivingPlan } from "../lib/living-plan/registry.js";

const wed = getFutureFieldAdapter("wedding");

const base = {
  wedding_date: "2027-06",
  guest_count: 150,
  venue_tier: "mid_range",
  venue_type: "hotel",
  total_budget: 34200,
  monthly_contribution: 900,
  current_savings: 20000,
};

test("wedding is a registered Future Field domain", () => {
  assert.ok(futureFieldSupportedDomains().includes("wedding"));
  assert.ok(wed);
});

test("wedding feasibility computes a real core total, payment schedule and required monthly", () => {
  const f = wed.feasibility(base);
  assert.equal(f.available, true);
  assert.ok(f.computedCoreTotal > 0, "banquet/photography/attire priced from real rate tables");
  assert.equal(f.totalBudget, 34200, "user ceiling is the plan total");
  assert.ok(Array.isArray(f.paymentSchedule) && f.paymentSchedule.length >= 2, "deposit + balance at least");
  assert.ok(f.requiredMonthly > 0);
  assert.equal(typeof f.fundedOnPace, "boolean");
});

test("wedding feasibility is honest when guest count is missing", () => {
  assert.equal(wed.feasibility({ ...base, guest_count: 0 }).available, false);
});

test("Peel: fewer guests lowers the real computed core total", () => {
  const bigger = wed.feasibility(base).computedCoreTotal;
  const peeled = peelBranch({
    baseData: base,
    overrides: { guest_count: 88 },
    feasibilityFn: (d) => wed.feasibility(d),
  });
  assert.deepEqual(peeled.delta.changedKeys, ["guest_count"]);
  assert.ok(peeled.feasibility.computedCoreTotal < bigger, "88 guests < 150 guests on real banquet math");
});

test("Peel: a bigger budget ceiling raises the required monthly contribution", () => {
  const smallReq = wed.feasibility(base).requiredMonthly;
  const peeled = peelBranch({
    baseData: base,
    overrides: { total_budget: 60000 },
    feasibilityFn: (d) => wed.feasibility(d),
  });
  assert.ok(peeled.feasibility.requiredMonthly > smallReq);
});

test("Bend: solve the monthly amount to be fully funded sooner", () => {
  const projector = wed.projector(base);
  const monthsAtCurrent = projector(base.monthly_contribution);
  assert.ok(monthsAtCurrent > 0);
  const target = Math.max(3, Math.round(monthsAtCurrent * 0.5));
  const solved = solveMonthlyForTargetMonths({ targetMonths: target, projectMonthsFn: projector, highAmount: 20000 });
  assert.ok(solved.achievable === false || (solved.amount > base.monthly_contribution && solved.projectedMonths <= target));
});

test("Pin: min_core_guests is checked against the real guest count", () => {
  const metrics = wed.constraintMetrics(base, null, { emergencyBufferMonths: 5, proposedMonthly: 1200 });
  assert.equal(metrics.min_core_guests, 150);
  const res = checkConstraints(
    [
      { kind: "min_core_guests", operator: "gte", value: 100 },
      { kind: "emergency_floor_months", operator: "gte", value: 6 },
    ],
    metrics,
  );
  assert.equal(res.ok, false);
  assert.ok(res.violations.some((v) => v.kind === "emergency_floor_months"));
  assert.ok(!res.violations.some((v) => v.kind === "min_core_guests"), "150 >= 100 core guests is fine");
});

test("Living Plan registry: all 9 domains are registered Living Plans", () => {
  assert.deepEqual(registeredLivingPlanDomains().sort(), ["emergency", "family", "home", "insurance", "investment", "loan", "retirement", "travel", "wedding"]);
  for (const d of ["wedding", "home", "emergency", "loan", "retirement", "travel", "investment", "insurance", "family"]) {
    assert.equal(isLivingPlan(d), true, `${d} is a Living Plan`);
    const spec = getLivingPlanSpec(d);
    assert.ok(spec.futureFieldDomain === d, `${d} has a Future Field adapter`);
    assert.ok(Array.isArray(spec.variables) && spec.variables.length >= 2);
    assert.ok(Array.isArray(spec.behaviours) && spec.behaviours.length >= 1);
  }
  assert.equal(getLivingPlanSpec("family").privacy, "individual_balances_never_shared");
  const w = getLivingPlanSpec("wedding");
  assert.ok(w.variables.some((v) => v.key === "guest_count"));
  assert.ok(w.impacts.includes("home") && w.impacts.includes("emergency"));
});
