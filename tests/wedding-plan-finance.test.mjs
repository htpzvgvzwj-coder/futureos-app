import test from "node:test";
import assert from "node:assert/strict";
import { computeWeddingPlanFinance } from "../lib/wedding/plan-finance.js";
import { WEDDING_RATE_PROVENANCE, WEDDING_ESTIMATE_DISCLAIMER } from "../lib/wedding/rate-provenance.js";

const base = {
  wedding_date: "2027-06",
  guest_count: 150,
  venue_tier: "mid_range",
  venue_type: "hotel",
  total_budget: 60000, // ceiling comfortably above core
  monthly_contribution: 900,
  partner_contribution: 0,
  current_savings: 15000,
};

test("finance: computes core total, ceiling, gap, feasibility separately", () => {
  const f = computeWeddingPlanFinance({ planData: base });
  assert.ok(f.computedCoreTotal > 0);
  assert.equal(f.userBudgetCeiling, 60000);
  assert.equal(f.budgetGap, 0);
  assert.equal(f.feasible, true);
  assert.equal(f.sealable, true);
  assert.deepEqual(f.unresolvedItems, []);
});

test("finance: a ceiling below core cost is NOT silently accepted - gap, not sealable, unresolved items listed", () => {
  const f = computeWeddingPlanFinance({ planData: { ...base, total_budget: 12000 } });
  assert.ok(f.budgetGap > 0, "real gap between ceiling and core");
  assert.equal(f.feasible, false);
  assert.equal(f.sealable, false);
  assert.equal(f.planStage, "needs_changes");
  assert.ok(f.unresolvedItems.length >= 1);
  // largest cost first so the UI can point at "the venue"
  assert.ok(f.unresolvedItems[0].subtotal >= f.unresolvedItems[f.unresolvedItems.length - 1].subtotal);
});

test("finance: partner contribution genuinely reduces the USER's required monthly, total cost unchanged", () => {
  const noPartner = computeWeddingPlanFinance({ planData: { ...base, partner_contribution: 0 } });
  const withPartner = computeWeddingPlanFinance({ planData: { ...base, partner_contribution: 400 } });

  assert.equal(withPartner.planTotal, noPartner.planTotal, "wedding total cost is unchanged by who pays");
  assert.equal(withPartner.totalShortfall, noPartner.totalShortfall, "combined shortfall unchanged");
  assert.ok(withPartner.userPersonalShortfall < noPartner.userPersonalShortfall, "partner covers part of it");
  assert.ok(withPartner.userRequiredMonthly < noPartner.userRequiredMonthly, "user needs less per month");
  assert.equal(withPartner.combinedRequiredMonthly, noPartner.combinedRequiredMonthly, "combined required is the same");
});

test("finance: partner contribution never turns a below-core budget into sealable", () => {
  const f = computeWeddingPlanFinance({ planData: { ...base, total_budget: 12000, partner_contribution: 2000 } });
  assert.equal(f.sealable, false);
});

test("finance: honest when guest count missing", () => {
  assert.equal(computeWeddingPlanFinance({ planData: { ...base, guest_count: 0 } }).available, false);
});

test("provenance: rates are reference estimates with source/asOf/region/range/confidence - never 'quote'", () => {
  assert.ok(WEDDING_RATE_PROVENANCE.length >= 3);
  for (const p of WEDDING_RATE_PROVENANCE) {
    assert.equal(p.sourceType, "reference_estimate");
    assert.ok(p.asOf && p.region && p.range && p.confidence);
    assert.doesNotMatch(p.sourceName.toLowerCase(), /quote|vendor price|current price/);
  }
  assert.match(WEDDING_ESTIMATE_DISCLAIMER, /estimate/i);
  assert.doesNotMatch(WEDDING_ESTIMATE_DISCLAIMER, /\breal Singapore rates\b/i);
});
