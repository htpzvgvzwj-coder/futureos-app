import test from "node:test";
import assert from "node:assert/strict";
import { computeLivingEnvelope, requiredPremiumForCover, PROTECTION_NODES } from "../lib/insurance/living-envelope-finance.js";
import { projectLivingEnvelopeImpact } from "../lib/insurance/living-envelope-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const ctx = { monthlyIncome: 8000, monthlyExpenses: 4000, otherGoalsMonthlyOutflow: 800 };
const reality = {
  monthly_expenses: 4000, income_protection_months: 12,
  existing_income_protection: 20000,
  home_loan_outstanding: 300000, existing_life_cover: 100000,
  dependents: 0,
  annual_care_cost: 10000, existing_ci_cover: 30000, care_years: 3,
  monthly_premium_now: 60,
};

test("the membrane has four life nodes; an Unknown node is never counted as a gap", () => {
  const l = computeLivingEnvelope({ planData: { ...reality, home_loan_outstanding: undefined, existing_life_cover: undefined }, context: ctx });
  assert.equal(l.available, true);
  assert.equal(l.membrane.length, PROTECTION_NODES.length);
  const homeLoan = l.membrane.find((m) => m.id === "home_loan");
  assert.equal(homeLoan.state, "unknown");
  assert.equal(homeLoan.exposureAmount, null, "unknown is never an exposure amount");
  assert.ok(l.unknownNodes.includes("home_loan"));
  assert.ok(l.unknowns.includes("home_loan_cover_or_need"));
});

test("SECTION M causal test: stretching the membrane to close an exposure costs premium; a lower premium frees it; exposure recomputes", () => {
  const base = computeLivingEnvelope({ planData: reality, context: ctx });
  assert.ok(base.knownExposure > 0, "there is a real known exposure");

  const stretched = computeLivingEnvelope({ planData: { ...reality, desired_cover: { income: 48000, home_loan: 300000 } }, context: ctx });
  assert.ok(stretched.knownExposure < base.knownExposure, "stretching cover shrinks the exposure");
  assert.ok(stretched.premiumAfter.value > base.premiumAfter.value, "stretching cover costs premium");

  const impact = projectLivingEnvelopeImpact({ branchPlan: { ...reality, desired_cover: { income: 48000, home_loan: 300000 } }, realityPlan: reality, context: ctx });
  assert.equal(validateImpactSet(impact).ok, true);
  assert.ok(impact.resourceDelta.addedPressureMonthly > 0);
  assert.equal(impact.resourceDelta.freedMonthly, 0);
  assert.ok(impact.resourceDelta.knownExposureAfter < impact.resourceDelta.knownExposureBefore);
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  for (const g of impact.affectedGoals) assert.equal(g.confirmedAfter, null, "possible only until allocated");

  const cheaper = projectLivingEnvelopeImpact({ branchPlan: { ...reality, monthly_premium_now: 30 }, realityPlan: reality, context: ctx });
  assert.equal(cheaper.resourceDelta.freedMonthly, 30);
  assert.equal(cheaper.resourceDelta.addedPressureMonthly, 0);
});

test("premium is a reference rate; sealing never buys a policy or runs underwriting", () => {
  const l = computeLivingEnvelope({ planData: reality, context: ctx });
  assert.ok(l.assumptions.some((a) => /not a quote|no underwriting/i.test(a.text)));
  assert.ok(l.assumptions.some((a) => /does not buy a policy/i.test(a.text)));
  assert.equal(requiredPremiumForCover({ fromHave: 0, toHave: 100000 }) > 0, true);
});

test("liquidity conflict blocks the Seal when the premium exceeds cashflow", () => {
  const l = computeLivingEnvelope({ planData: { ...reality, monthly_premium_now: 5000 }, context: ctx });
  assert.equal(l.liquidityConflict, true);
  assert.equal(l.sealable, false);
  assert.equal(l.sealableReason, "premium_exceeds_cashflow");
});

test("a minimum_income_protection_months Pin below the target blocks the Seal", () => {
  const l = computeLivingEnvelope({ planData: { ...reality, income_protection_months: 6, minimum_income_protection_months: 12 }, context: ctx });
  assert.equal(l.belowIncomeFloor, true);
  assert.equal(l.sealable, false);
  assert.equal(l.sealableReason, "below_income_protection_floor");
});

test("insuranceAdapter carries the Envelope, the domain pins, and a valid cross-goal impactSet", () => {
  const adapter = getFutureFieldAdapter("insurance");
  const f = adapter.feasibility(reality, ctx);
  assert.ok(f.envelope && f.envelope.available);
  const m = adapter.constraintMetrics(reality, f, ctx);
  assert.equal(m.minimum_income_protection_months, 12);
  assert.equal(m.no_underwriting_or_quote, false);
  assert.equal(typeof m.maximum_monthly_contribution, "number");
  const impact = adapter.projectImpacts({ ...reality, desired_cover: { income: 48000 } }, reality, ctx, null);
  assert.equal(validateImpactSet(impact).ok, true);
});
