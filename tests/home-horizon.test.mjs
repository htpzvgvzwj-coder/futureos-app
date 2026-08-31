import test from "node:test";
import assert from "node:assert/strict";
import { computeHomeHorizon, safePriceForMonth } from "../lib/home/horizon-finance.js";
import { projectHomeImpact } from "../lib/home/horizon-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const base = {
  estimated_price: 550000,
  property_type: "hdb_resale",
  monthly_income: 8500,
  monthly_expenses: 4000,
  current_savings: 180000,
  monthly_contribution: 2500,
  target_complete_month: "2027-06",
};
const ctx = { committedMonthlyTotalExcludingHome: 600, emergencyBufferMonths: 8 };

test("computeHomeHorizon: real upfront stack, repayment, ready month and post-purchase life", () => {
  const h = computeHomeHorizon({ planData: base, context: ctx });
  assert.equal(h.available, true);
  assert.ok(h.upfrontStack.upfrontCashRequired.value > 0);
  assert.ok(h.loan.monthlyRepayment.value > 0);
  assert.ok(h.loan.principal.value === h.price.value - h.upfrontStack.downPayment.value);
  assert.ok(h.readiness.monthsToReady != null);
  assert.equal(typeof h.afterlife.postPurchaseEmergencyMonths, "number");
  assert.equal(typeof h.sealable, "boolean");
  // Rate Weather is a RANGE from the assumption, never a forecast
  assert.ok(h.loan.repaymentRange.high > h.loan.monthlyRepayment.value);
  assert.ok(/not a prediction/i.test(h.loan.repaymentRange.note));
});

test("SECTION M causal test: raising the price raises upfront + monthly and drops the emergency buffer; a floor can block Seal", () => {
  const lo = computeHomeHorizon({ planData: base, context: ctx });
  const hi = computeHomeHorizon({ planData: { ...base, estimated_price: 850000 }, context: ctx });
  assert.ok(hi.upfrontStack.upfrontCashRequired.value > lo.upfrontStack.upfrontCashRequired.value, "upfront up");
  assert.ok(hi.loan.monthlyRepayment.value > lo.loan.monthlyRepayment.value, "monthly up");
  assert.ok(hi.afterlife.postPurchaseEmergencyMonths < lo.afterlife.postPurchaseEmergencyMonths, "buffer down");
  // at 850k this household drops below its emergency floor -> NOT sealable
  assert.equal(hi.sealable, false);
  assert.equal(hi.sealableReason, "below_emergency_floor");
});

test("Safe Price Shadow: a real price, and a later month affords a higher safe price", () => {
  const early = safePriceForMonth({ purchaseMonth: "2026-12", planData: base, context: ctx });
  const late = safePriceForMonth({ purchaseMonth: "2029-12", planData: base, context: ctx });
  assert.ok(early > 100000 && early < 3000000);
  assert.ok(late >= early, "more months of saving -> a higher safe price");
});

test("projectHomeImpact returns a valid server impactSet; emergency goes DOWN and stays a ghost until allocated", () => {
  const is = projectHomeImpact({
    branchData: { ...base, estimated_price: 780000 },
    realityData: base,
    context: { ...ctx, weddingActive: true, retirementActive: true },
  });
  assert.equal(validateImpactSet(is).ok, true);
  const em = is.affectedGoals.find((g) => g.goalId === "emergency");
  assert.equal(em.direction, "down");
  assert.equal(em.confirmedAfter, null, "possible only - not confirmed without an allocation");
  assert.ok(is.affectedGoals.filter((g) => g.direction !== "flat").length >= 2, "at least two affected goals move");
  // with an allocation, the placed legs move to "placed" (a definite Ghost:
  // placedAfter set, still not Solid - only Seal confirms).
  const placed = projectHomeImpact({
    branchData: { ...base, estimated_price: 780000 },
    realityData: base,
    context: { ...ctx, weddingActive: true, retirementActive: true },
    allocation: { emergencyMonthly: 200 },
  });
  const pem = placed.affectedGoals.find((g) => g.goalId === "emergency");
  assert.equal(pem.effectState, "placed");
  assert.notEqual(pem.placedAfter, null);
  assert.equal(pem.confirmedAfter, null, "nothing is Solid until Seal");
});

test("CPF and partner money stay UNKNOWN unless confirmed - never defaulted, never counted", () => {
  const h = computeHomeHorizon({ planData: base, context: ctx });
  assert.equal(h.upfrontStack.cpfApplied.value, null);
  assert.equal(h.upfrontStack.cpfApplied.provenance, "unknown");
  assert.equal(h.upfrontStack.partnerApplied.value, null);
  assert.ok(h.assumptions.some((a) => /CPF not confirmed/i.test(a.text)));
  // once confirmed, it is applied and reduces the upfront cash
  const withCpf = computeHomeHorizon({ planData: { ...base, cpf_available: 60000 }, context: ctx });
  assert.equal(withCpf.upfrontStack.cpfApplied.provenance, "user_confirmed");
  assert.ok(withCpf.upfrontStack.upfrontCashRequired.value < h.upfrontStack.upfrontCashRequired.value);
});

test("homeAdapter exposes the six Home domain pins as real metrics", () => {
  const adapter = getFutureFieldAdapter("home");
  const m = adapter.constraintMetrics({ ...base, partner_contribution: 40000 }, null, { emergencyBufferMonths: 8, committedExcludingWedding: 600 });
  assert.equal(typeof m.minimum_emergency_months, "number");
  assert.equal(typeof m.maximum_monthly_repayment, "number");
  assert.equal(m.no_partner_share, true, "partner money used -> the no_partner_share flag trips");
  assert.equal(m.latest_purchase_month, 202706);
  assert.equal(typeof m.minimum_post_purchase_cash, "number");
});

test("homeAdapter.feasibility now carries the Horizon and its explicit sealable verdict", () => {
  const adapter = getFutureFieldAdapter("home");
  const f = adapter.feasibility(base, { emergencyBufferMonths: 8, committedExcludingWedding: 600 });
  assert.ok(f.horizon && f.horizon.available);
  assert.equal(typeof f.sealable, "boolean");
  assert.equal(f.sealableReason, f.horizon.sealableReason);
});
