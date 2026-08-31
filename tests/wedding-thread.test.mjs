import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("wedding: an unknown guest count / date is surfaced, never a fabricated wedding cost", async () => {
  const { computeWeddingPlanFinance } = await import("../lib/wedding/plan-finance.js");
  const noGuests = computeWeddingPlanFinance({ planData: { ...reality, guest_count: 0 } });
  assert.equal(noGuests.available, false, "no guest count -> the wedding math is unavailable, not a made-up number");
  assert.ok(/guest/i.test(String(noGuests.reason ?? "")), "the reason names the missing input");
  // the continuous scene renders an explicit unknown branch for it
  const src = readFileSync(new URL("../app/features/wedding/WeddingContinuousScene.jsx", import.meta.url), "utf8");
  assert.match(src, /realityUnknowns|unknown\.guest_count|noPlan/);
});

test("wedding: two domain-specific pins are declared as real registry constraints", async () => {
  const { getStudioContract, getLivingPlanSpec } = await import("../lib/living-plan/registry.js");
  const contract = getStudioContract("wedding");
  const spec = getLivingPlanSpec("wedding");
  const generic = new Set(["emergency_floor_months", "max_monthly_contribution", "no_guardian_auto_move", "no_balance_share"]);
  const domainPins = (contract.constraintKinds ?? spec.constraints ?? []).filter((c) => !generic.has(c));
  assert.ok(domainPins.includes("min_core_guests"));
  assert.ok(domainPins.includes("latest_wedding_month"));
  assert.ok(domainPins.includes("minimum_guest_experience_spend"));
  assert.ok(domainPins.length >= 2);
});

test("wedding Couple Alignment: blindMerge shows only the overlap + conflicts, never a private amount", async () => {
  const { blindMerge } = await import("../lib/family/constellation-finance.js");
  const items = ["venue", "photography", "catering"].map((id) => ({ id, monthlyCost: 0 }));
  const merged = blindMerge({
    partnerA: { affordableMin: 900, affordableMax: 1600, mustKeep: ["venue"], flexible: ["photography"], undecided: ["catering"] },
    partnerB: { affordableMin: 1100, affordableMax: 1800, mustKeep: ["venue", "catering"], flexible: [], undecided: ["photography"] },
    sharedItems: items,
  });
  // the shared band is the OVERLAP only
  assert.deepEqual(merged.jointBand, { low: 1100, high: 1600 });
  // A's raw min/max are NOT in the returned object anywhere
  const s = JSON.stringify(merged);
  assert.ok(!s.includes("900") && !s.includes("1800"), "no private ceiling / floor leaks");
  // catering is a conflict (one Must Keep, one Undecided) -> both must reconfirm
  assert.ok(merged.conflicts.length >= 1);
  assert.equal(merged.bothConfirmedRequired, true);
  // venue is agreed by both
  assert.deepEqual(merged.agreedMustKeep, ["venue"]);
});

test("wedding continuous scene: Guest Orbit tiers + Couple Alignment + conflict->branch are wired", () => {
  const src = readFileSync(new URL("../app/features/wedding/WeddingContinuousScene.jsx", import.meta.url), "utf8");
  assert.match(src, /GUEST_TIERS = \["inner", "family", "friends"\]/, "three concentric guest tiers");
  assert.match(src, /blindMerge\(/, "Couple Alignment runs a real blind merge");
  assert.match(src, /s\.forkBranch\(/, "resolving a conflict produces a real branch (Change Replay entry)");
  assert.match(src, /guest_tiers|couple_alignment/, "the new vars feed the same branchVars -> same Life Thread");
  assert.match(src, /VENUE_TYPES|venue_type/, "venue type recomputes alongside tier / date / guests");
});
