import test from "node:test";
import assert from "node:assert/strict";
import { getFutureFieldAdapter, futureFieldSupportedDomains } from "../lib/future-field/adapters.js";
import { computeTravelPlanFinance } from "../lib/travel/plan-finance.js";
import { TRAVEL_RATE_PROVENANCE } from "../lib/travel/rate-provenance.js";
import { peelBranch } from "../lib/plan-runtime/index.js";

const travel = getFutureFieldAdapter("travel");
const invest = getFutureFieldAdapter("investment");

const NOW = new Date("2026-09-15T00:00:00Z");
const tripReality = {
  destination_type: "regional",
  comfort_tier: "mid",
  travellers: 2,
  nights: 8,
  trip_month: "2027-06",
  total_budget: null,
  monthly_contribution: 300,
  current_savings: 1500,
};
const ctx = {
  monthlyIncome: 7000,
  monthlyExpenses: 3800,
  committedExcludingDomain: 900,
  emergencyBufferMonths: 6.5,
  home: { monthlyContribution: 800, downPaymentNeeded: 140000, currentSavings: 40000 },
};

test("travel + investment are registered Future Field domains", () => {
  const d = futureFieldSupportedDomains();
  assert.ok(d.includes("travel") && d.includes("investment"));
});

test("travel finance: real cost from reference rates, payment schedule, required monthly", () => {
  const f = computeTravelPlanFinance({ planData: tripReality, now: NOW });
  assert.equal(f.available, true);
  assert.ok(f.computedCoreTotal > 0);
  assert.equal(f.lineItems.length, 3);
  assert.ok(f.paymentSchedule.length === 2 && f.paymentSchedule[0].id === "deposit");
  assert.ok(f.userRequiredMonthly > 0);
});

test("travel: a fixed budget below the real cost is NOT sealable; the gap + items are shown", () => {
  const f = computeTravelPlanFinance({ planData: { ...tripReality, total_budget: 500 }, now: NOW });
  assert.ok(f.budgetGap > 0);
  assert.equal(f.sealable, false);
  assert.equal(f.planStage, "needs_changes");
  assert.ok(f.unresolvedItems.length >= 1);
});

test("travel: fewer nights lowers the real cost; the unified impactSet frees monthly pace, ghost until allocated", () => {
  const big = travel.feasibility(tripReality).computedCoreTotal;
  const branch = { ...tripReality, nights: 4 };
  assert.ok(travel.feasibility(branch).computedCoreTotal < big);
  // Living Thread commit 6: projectImpacts returns the studio-contract
  // impactSet (Calendar Orbit), not the old monthly-shift shape.
  const impact = travel.projectImpacts(branch, tripReality, ctx);
  assert.equal(impact.resourceDelta.addedPressureMonthly, 0);
  assert.ok(impact.resourceDelta.freedMonthly >= 0);
  assert.ok(impact.resourceDelta.tripCostRangeAfter && impact.resourceDelta.tripCostRangeAfter.low != null, "trip cost is a range");
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null), "possible only until allocated");
});

test("travel: a bigger trip is monthly PRESSURE with named sources, not a free lunch", () => {
  const branch = { ...tripReality, travellers: 4, nights: 14, comfort_tier: "premium" };
  const impact = travel.projectImpacts(branch, tripReality, ctx);
  assert.ok(impact.resourceDelta.addedPressureMonthly > 0);
  assert.equal(impact.resourceDelta.freedMonthly, 0);
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.equal(impact.allocationRequired, true);
});

test("travel provenance: reference estimates, never 'quote'", () => {
  for (const p of TRAVEL_RATE_PROVENANCE) {
    assert.equal(p.sourceType, "reference_estimate");
    assert.ok(p.asOf && p.region && p.range && p.confidence);
  }
});

test("investment feasibility: readiness gate + years-to-target, NO return assumed", () => {
  const f = invest.feasibility({
    monthly_commitment: 1500,
    horizon_years: 10,
    target_pool: 200000,
    current_savings: 20000,
    monthly_expenses: 3800,
    credit_card_outstanding: 0,
    available_monthly_cashflow: 1500,
  });
  assert.equal(f.available, true);
  assert.ok(["readyToInvest", "buildBufferFirst", "payDownDebtFirst", "noRoomYet"].includes(f.readiness));
  assert.equal(f.contributedByHorizon, 1500 * 120 + 20000, "contributed amount only");
  assert.ok(f.monthsToTarget > 0);
});

test("investment: more into investing is pressure now; less frees cashflow", () => {
  const reality = { monthly_commitment: 1000, horizon_years: 10, target_pool: 150000, current_savings: 10000, monthly_expenses: 3800, credit_card_outstanding: 0, available_monthly_cashflow: 2000 };
  const more = invest.projectImpacts({ ...reality, monthly_commitment: 1400 }, reality, ctx);
  assert.equal(more.mode, "pressure");
  assert.equal(more.pressure.extraMonthlyNeeded, 400);
  const less = invest.projectImpacts({ ...reality, monthly_commitment: 700 }, reality, ctx);
  assert.equal(less.mode, "freed");
  assert.equal(less.freedCashflow, 300);
  assert.equal(less.allocatedImpact, null);
});

test("peelBranch works with the travel adapter", () => {
  const out = peelBranch({ baseData: tripReality, overrides: { travellers: 3 }, feasibilityFn: (d) => travel.feasibility(d) });
  assert.deepEqual(out.delta.changedKeys, ["travellers"]);
});
