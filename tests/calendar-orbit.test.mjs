import test from "node:test";
import assert from "node:assert/strict";
import { computeCalendarOrbit, requiredMonthlyForTripMonth, seasonFor } from "../lib/travel/calendar-orbit-finance.js";
import { projectCalendarOrbitImpact } from "../lib/travel/calendar-orbit-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const NOW = new Date("2026-09-15T00:00:00Z");
const ctx = { monthlyIncome: 7000, monthlyExpenses: 3800, otherGoalsMonthlyOutflow: 900, currentSavings: 4000, emergencyBufferMonths: 6, now: NOW };
const trip = (over = {}) => ({
  destination_type: "regional", comfort_tier: "mid", travellers: 2, nights: 8,
  trip_month: "2027-06", total_budget: null, monthly_contribution: 300, current_savings: 4000, ...over,
});

test("trip cost is a transparent RANGE with a seasonality multiplier, never a single number", () => {
  const o = computeCalendarOrbit({ planData: trip(), context: ctx, now: NOW });
  assert.equal(o.available, true);
  assert.ok(o.tripCostRange.low < o.tripCostRange.expected && o.tripCostRange.expected < o.tripCostRange.high);
  assert.equal(seasonFor(6).key, "peak");
  assert.equal(o.season.key, "peak");
  assert.ok(o.assumptions.some((a) => /never a fare prediction|seasonal/i.test(a.text)));
});

test("SECTION M causal test: a bigger trip raises the required monthly pace; a later trip lowers it; the RANGE is kept", () => {
  const base = computeCalendarOrbit({ planData: trip(), context: ctx, now: NOW });
  const bigger = computeCalendarOrbit({ planData: trip({ travellers: 4, nights: 16, comfort_tier: "premium" }), context: ctx, now: NOW });
  const later = computeCalendarOrbit({ planData: trip({ trip_month: "2027-12" }), context: ctx, now: NOW });

  assert.ok(bigger.requiredMonthly > base.requiredMonthly, "bigger trip -> more per month");
  assert.ok(later.fundingWindow > base.fundingWindow, "a later trip has a longer funding window");
  assert.ok(later.requiredMonthly < base.requiredMonthly, "a later trip -> less per month");

  const impact = projectCalendarOrbitImpact({ branchPlan: trip({ travellers: 4, nights: 16, comfort_tier: "premium" }), realityPlan: trip(), context: ctx, now: NOW });
  assert.equal(validateImpactSet(impact).ok, true);
  assert.ok(impact.resourceDelta.addedPressureMonthly > 0);
  assert.equal(impact.resourceDelta.freedMonthly, 0);
  assert.ok(impact.resourceDelta.tripCostRangeAfter && impact.resourceDelta.tripCostRangeAfter.low != null, "the impactSet carries the trip cost as a range");
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  for (const g of impact.affectedGoals) assert.equal(g.confirmedAfter, null, "possible only until allocated");
});

test("a fixed budget below the real cost is NOT sealable; the gap is shown", () => {
  const o = computeCalendarOrbit({ planData: trip({ total_budget: 500 }), context: ctx, now: NOW });
  assert.ok(o.budgetGap > 0);
  assert.equal(o.feasible, false);
  assert.equal(o.sealable, false);
  assert.equal(o.sealableReason, "budget_below_real_cost");
});

test("unknown earmarked savings stay FOG - the funding pace is not computed, never zero", () => {
  const o = computeCalendarOrbit({ planData: { ...trip(), current_savings: undefined }, context: { monthlyIncome: 7000, monthlyExpenses: 3800, otherGoalsMonthlyOutflow: 900, now: NOW }, now: NOW });
  assert.equal(o.available, true);
  assert.equal(o.earmarked.provenance, "unknown");
  assert.equal(o.requiredMonthly, null);
  assert.equal(o.paceState, "unknown");
  assert.ok(o.unknowns.includes("current_savings"));
});

test("liquidity conflict blocks the Seal when the contribution exceeds cashflow", () => {
  const o = computeCalendarOrbit({ planData: trip({ monthly_contribution: 4000 }), context: ctx, now: NOW });
  assert.equal(o.liquidityConflict, true);
  assert.equal(o.sealable, false);
  assert.equal(o.sealableReason, "contribution_exceeds_cashflow");
});

test("a trip that slips past a pinned latest_trip_month is not sealable", () => {
  const o = computeCalendarOrbit({ planData: trip({ trip_month: "2028-03", latest_trip_month: 202712 }), context: ctx, now: NOW });
  assert.equal(o.pastLatest, true);
  assert.equal(o.sealable, false);
  assert.equal(o.sealableReason, "trip_slips_past_pinned_month");
});

test("requiredMonthlyForTripMonth: a later month gives a longer funding window and a lower pace", () => {
  const near = requiredMonthlyForTripMonth({ planData: trip(), context: ctx, tripMonth: "2027-06", now: NOW });
  const far = requiredMonthlyForTripMonth({ planData: trip(), context: ctx, tripMonth: "2028-03", now: NOW });
  assert.ok(far.fundingWindow > near.fundingWindow);
  assert.ok(far.requiredMonthly < near.requiredMonthly);
});

test("travelAdapter carries the Orbit, the domain pins, and a valid cross-goal impactSet", () => {
  const adapter = getFutureFieldAdapter("travel");
  const f = adapter.feasibility(trip(), ctx);
  assert.ok(f.orbit && f.orbit.available);
  const m = adapter.constraintMetrics(trip(), f, ctx);
  assert.equal(m.maximum_monthly_contribution, 300);
  assert.equal(m.latest_trip_month, 202706);
  assert.equal(typeof m.no_trip_funding_below_emergency_floor, "boolean");
  const impact = adapter.projectImpacts({ ...trip(), travellers: 4, nights: 16, comfort_tier: "premium" }, trip(), ctx, null);
  assert.equal(validateImpactSet(impact).ok, true);
});
