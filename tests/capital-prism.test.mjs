import test from "node:test";
import assert from "node:assert/strict";
import { computeCapitalPrism, requiredInvestingForTargetYears, PRISM_BANDS } from "../lib/investment/capital-prism-finance.js";
import { projectCapitalPrismImpact } from "../lib/investment/capital-prism-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const ctx = { availableMonthlyCashflow: 2000, monthlyExpenses: 3800, emergencyBufferMonths: 6 };
const plan = (jobs, over = {}) => ({
  jobs, liquidity_gate_years: 3, target_pool: 200000, current_savings: 30000,
  credit_card_outstanding: 0, monthly_expenses: 3800, ...over,
});

test("capital splits into six spectral jobs; assignment is conserved, over-allocation is flagged", () => {
  const p = computeCapitalPrism({ planData: plan({ safety: 500, flexible: 500, longTerm: 1000 }), context: ctx });
  assert.equal(p.available, true);
  assert.equal(PRISM_BANDS.length, 6);
  assert.equal(p.assigned, 2000);
  assert.equal(p.unassigned, 0);
  assert.equal(p.over, false);
  assert.equal(p.investingCommitment.value, 1000);
  assert.equal(p.liquidKept.value, 1000);
});

test("SECTION M causal test: more into the locked bands -> pressure + sooner target; less -> frees liquid capital; readiness gate blocks", () => {
  const base = computeCapitalPrism({ planData: plan({ flexible: 1000, longTerm: 1000 }), context: ctx });
  const more = computeCapitalPrism({ planData: plan({ flexible: 500, longTerm: 1500 }), context: ctx });
  assert.ok(more.yearsToTarget < base.yearsToTarget, "more investing -> sooner to target");

  const impUp = projectCapitalPrismImpact({ branchPlan: plan({ flexible: 500, longTerm: 1500 }), realityPlan: plan({ flexible: 1000, longTerm: 1000 }), context: ctx });
  assert.equal(validateImpactSet(impUp).ok, true);
  assert.equal(impUp.resourceDelta.addedPressureMonthly, 500);
  assert.equal(impUp.resourceDelta.freedMonthly, 0);
  assert.ok(impUp.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  for (const g of impUp.affectedGoals) assert.equal(g.confirmedAfter, null, "possible only until allocated");

  const impDown = projectCapitalPrismImpact({ branchPlan: plan({ flexible: 1500, longTerm: 500 }), realityPlan: plan({ flexible: 1000, longTerm: 1000 }), context: ctx });
  assert.equal(impDown.resourceDelta.freedMonthly, 500);
  assert.equal(impDown.resourceDelta.addedPressureMonthly, 0);

  const notReady = computeCapitalPrism({ planData: plan({ flexible: 1000, longTerm: 1000 }, { current_savings: 5000 }), context: ctx });
  assert.equal(notReady.readiness, "buildBufferFirst");
  assert.equal(notReady.investingBlockedByGate, true);
  assert.equal(notReady.sealable, false);
  assert.equal(notReady.sealableReason, "buildBufferFirst");
});

test("NO investment return is assumed in the base; an optimistic band only appears with a stated assumption", () => {
  const base = computeCapitalPrism({ planData: plan({ flexible: 500, longTerm: 1500 }), context: ctx });
  assert.equal(base.optimistic, null);
  assert.ok(base.assumptions.some((a) => /No investment return is assumed/i.test(a.text)));
  const withRr = computeCapitalPrism({ planData: plan({ flexible: 500, longTerm: 1500 }, { real_return_assumption: 5 }), context: ctx });
  assert.ok(withRr.optimistic && withRr.optimistic.years < base.yearsToTarget);
  assert.ok(/never a guarantee/i.test(withRr.optimistic.note));
});

test("unknown capital pool stays FOG - not computed as 0", () => {
  const p = computeCapitalPrism({ planData: { jobs: { longTerm: 500 }, target_pool: 100000 }, context: {} });
  assert.equal(p.available, true);
  assert.equal(p.poolKnown, false);
  assert.equal(p.pool.provenance, "unknown");
  assert.equal(p.sealable, false);
  assert.equal(p.sealableReason, "capital_pool_unknown");
  assert.ok(p.unknowns.includes("available_monthly_cashflow"));
});

test("over-allocating the capital pool blocks the Seal", () => {
  const p = computeCapitalPrism({ planData: plan({ flexible: 1500, longTerm: 1500 }), context: ctx });
  assert.equal(p.over, true);
  assert.equal(p.sealable, false);
  assert.equal(p.sealableReason, "capital_over_allocated");
});

test("the Liquidity Gate changes how much capital is reachable within N years", () => {
  const near = computeCapitalPrism({ planData: plan({ home: 800, retirement: 1200 }, { liquidity_gate_years: 3 }), context: ctx });
  const far = computeCapitalPrism({ planData: plan({ home: 800, retirement: 1200 }, { liquidity_gate_years: 25 }), context: ctx });
  assert.ok(far.reachableWithinGate.value > near.reachableWithinGate.value);
  assert.equal(near.reachableWithinGate.value, 800);
});

test("requiredInvestingForTargetYears is contributed-amount-only (no return)", () => {
  const p = computeCapitalPrism({ planData: plan({ flexible: 1000, longTerm: 1000 }), context: ctx });
  const r = requiredInvestingForTargetYears({ prism: p, byYears: 10 });
  assert.equal(r, Math.ceil((200000 - 30000) / 120));
});

test("investmentAdapter carries the Prism, the domain pins, and a valid cross-goal impactSet", () => {
  const adapter = getFutureFieldAdapter("investment");
  const pd = plan({ safety: 0, wedding: 0, home: 0, flexible: 1000, retirement: 0, longTerm: 1000 });
  const f = adapter.feasibility(pd, ctx);
  assert.ok(f.prism && f.prism.available);
  const m = adapter.constraintMetrics(pd, f, ctx);
  assert.equal(m.maximum_monthly_contribution, 1000);
  assert.equal(typeof m.no_investing_below_readiness_gate, "boolean");
  assert.equal(typeof m.minimum_liquid_capital, "number");
  const impact = adapter.projectImpacts(plan({ flexible: 500, longTerm: 1500 }), pd, ctx, null);
  assert.equal(validateImpactSet(impact).ok, true);
});
