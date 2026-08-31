import test from "node:test";
import assert from "node:assert/strict";
import { projectWeddingThreadImpact } from "../lib/wedding/wedding-thread-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const wed = getFutureFieldAdapter("wedding");
const ctx = { monthlyIncome: 8000, monthlyExpenses: 3800, committedExcludingWedding: 900 };
const reality = {
  wedding_date: "2027-06", guest_count: 150, venue_tier: "mid_range", venue_type: "hotel",
  photography_tier: "mid", attire_tier: "mid", total_budget: null,
  monthly_contribution: 800, partner_contribution: 400, current_savings: 6000,
};

test("Wedding adapter now emits the shared Studio-Contract impactSet (ghost/solid, named pressure)", () => {
  const impact = wed.projectImpacts({ ...reality, guest_count: 90 }, reality, ctx);
  assert.equal(validateImpactSet(impact).ok, true);
  assert.ok("freedMonthly" in impact.resourceDelta && "addedPressureMonthly" in impact.resourceDelta);
  assert.ok(Array.isArray(impact.affectedGoals) && impact.affectedGoals.length >= 2);
});

test("SECTION M causal test: fewer guests frees the user's monthly need; a bigger wedding is named pressure; ghost until allocated", () => {
  const smaller = projectWeddingThreadImpact({ branchPlan: { ...reality, guest_count: 80 }, realityPlan: reality, context: ctx });
  assert.equal(validateImpactSet(smaller).ok, true);
  assert.ok(smaller.resourceDelta.freedMonthly > 0, "fewer guests -> freed monthly");
  assert.equal(smaller.resourceDelta.addedPressureMonthly, 0);
  assert.ok(smaller.affectedGoals.every((g) => g.confirmedAfter == null), "possible only until allocated");

  const bigger = projectWeddingThreadImpact({ branchPlan: { ...reality, guest_count: 240, venue_tier: "premium" }, realityPlan: reality, context: ctx });
  assert.ok(bigger.resourceDelta.addedPressureMonthly > 0, "a bigger wedding -> monthly pressure");
  assert.equal(bigger.resourceDelta.freedMonthly, 0);
  assert.ok(bigger.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.equal(bigger.allocationRequired, true);
});

test("allocating the freed amount turns a goal solid; nothing is auto-routed", () => {
  const ghost = projectWeddingThreadImpact({ branchPlan: { ...reality, guest_count: 80 }, realityPlan: reality, context: ctx });
  assert.ok(ghost.affectedGoals.every((g) => g.confirmedAfter == null));
  // Per-leg: allocate ONLY to Home -> Home solid, every other leg ghost.
  const placed = projectWeddingThreadImpact({
    branchPlan: { ...reality, guest_count: 80 },
    realityPlan: reality,
    context: ctx,
    allocation: { home: Math.round(ghost.resourceDelta.freedMonthly) },
  });
  assert.notEqual(placed.affectedGoals.find((g) => g.goalId === "home").confirmedAfter, null, "the funded Home leg is solid");
  assert.equal(placed.affectedGoals.find((g) => g.goalId === "retirement").confirmedAfter, null, "Retirement was not funded -> ghost");
  assert.equal(placed.affectedGoals.find((g) => g.goalId === "emergency").confirmedAfter, null, "Emergency was not funded -> ghost");
});

test("the legacy two-layer wedding projection is still available for the existing scene", () => {
  const legacy = wed.legacyProjectImpacts({ ...reality, guest_count: 90 }, reality, ctx);
  assert.ok(legacy && ("mode" in legacy || "availableImpact" in legacy), "legacy shape preserved");
});
