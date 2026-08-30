import test from "node:test";
import assert from "node:assert/strict";
import { validateSealAllocation, resolveAllowedTargets } from "../lib/plan-runtime/atomic-seal.js";
import { buildHandoffCandidate } from "../lib/living-plan/future-handoff.js";
import { routeIntent, INTENT_ROUTES } from "../app/features/explore/intent-router.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

// ---- Part 0.1: allocation validation gates the atomic seal ------------
test("validateSealAllocation: nothing allocated -> ok, stays flexible", () => {
  const r = validateSealAllocation({ allocation: null, freedCashflow: 300 });
  assert.deepEqual(r, { ok: true, allocation: null, targetGoalId: null });
});

test("validateSealAllocation: over-allocating is rejected", () => {
  const r = validateSealAllocation({ allocation: { flexibleMonthly: 500 }, freedCashflow: 300, allowedTargets: ["home"] });
  assert.equal(r.ok, false);
  assert.equal(r.error, "over_allocated");
});

test("validateSealAllocation: a funded goal leg with no target is rejected", () => {
  const r = validateSealAllocation({ allocation: { goalMonthly: 200 }, allocationTargetGoalId: null, freedCashflow: 300, allowedTargets: ["home", "emergency"] });
  assert.equal(r.ok, false);
  assert.equal(r.error, "missing_allocation_target");
});

test("validateSealAllocation: a goal target that is not an active goal is rejected", () => {
  const r = validateSealAllocation({ allocation: { goalMonthly: 200 }, allocationTargetGoalId: "yacht", freedCashflow: 300, allowedTargets: ["home", "emergency"] });
  assert.equal(r.ok, false);
  assert.equal(r.error, "target_not_active_goal");
});

test("validateSealAllocation: an explicit, active target passes and is echoed back", () => {
  const r = validateSealAllocation({ allocation: { goalMonthly: 200 }, allocationTargetGoalId: "retirement", freedCashflow: 300, allowedTargets: ["retirement", "emergency"] });
  assert.equal(r.ok, true);
  assert.equal(r.targetGoalId, "retirement");
});

test("resolveAllowedTargets always includes emergency and never invents Home", () => {
  assert.deepEqual(resolveAllowedTargets([]), ["emergency"]);
  assert.deepEqual(resolveAllowedTargets(["loan", "travel"]).sort(), ["emergency", "loan", "travel"]);
});

// ---- Part 0.2: handoff targeting is explicit, never Home-by-default ---
test("handoff: destinations are the customer's active goals minus source, + emergency + flexible", () => {
  const h = buildHandoffCandidate({
    commitment: { id: "c", domain: "loan", monthly_contribution: 400, status: "active" },
    reason: "revoked",
    activeGoals: ["retirement", "travel", "investment", "loan"],
  });
  assert.ok(h.targets.includes("retirement") && h.targets.includes("travel") && h.targets.includes("investment"));
  assert.ok(!h.targets.includes("loan"), "source goal is excluded");
  assert.ok(h.targets.includes("emergency") && h.targets.includes("flexible"));
});

test("handoff: an out-of-set targetGoalId is dropped to null (would become Flexible)", () => {
  const h = buildHandoffCandidate({
    commitment: { id: "c", domain: "loan", monthly_contribution: 400, status: "active" },
    reason: "revoked",
    activeGoals: ["retirement"],
    targetGoalId: "home", // home is not an active goal here
  });
  assert.equal(h.targetGoalId, null);
});

test("handoff: a valid in-set targetGoalId is kept - Retirement / Travel / Investment all reachable", () => {
  for (const g of ["retirement", "travel", "investment"]) {
    const h = buildHandoffCandidate({
      commitment: { id: "c", domain: "home", monthly_contribution: 300, status: "active" },
      reason: "revoked",
      activeGoals: [g],
      targetGoalId: g,
    });
    assert.equal(h.targetGoalId, g);
    assert.notEqual(h.targetGoalId, "home");
  }
});

// ---- Part 0.4: every adapter returns an EXPLICIT sealable boolean -----
test("every Future Field adapter's feasibility returns an explicit boolean `sealable`", () => {
  const domains = ["home", "wedding", "emergency", "loan", "retirement", "travel", "investment", "insurance", "family"];
  for (const d of domains) {
    const adapter = getFutureFieldAdapter(d);
    // a minimal available planData per domain
    const planData = {
      estimated_price: 400000, property_type: "hdb_resale", monthly_income: 7000, monthly_expenses: 3500,
      monthly_expenses_: 3500, current_savings: 20000, monthly_contribution: 800,
      guest_count: 100, venue_tier: "mid_range", venue_type: "hotel", total_budget: 40000, wedding_date: "2027-06",
      loan_amount: 200000, annual_rate_percent: 3.5, tenure_years: 25, monthly_installment: 1000,
      gap_monthly: 800, target_monthly_income: 3000,
      travellers: 2, nights: 7, comfort_tier: "mid", destination_type: "regional", trip_month: "2027-03",
      monthly_commitment: 500, horizon_years: 10, available_monthly_cashflow: 1500,
      income_protection_months: 12,
      shared_monthly_contribution: 1500, partner_share_ratio: 0.5, items: [],
    };
    const f = adapter.feasibility(planData);
    if (f.available === false) continue; // an unavailable path has no seal verdict to give
    assert.equal(typeof f.sealable, "boolean", `${d}.feasibility.sealable is an explicit boolean`);
  }
});

// ---- Part 2: intent routing is deterministic and honest about confidence
test("routeIntent: a clear single intent -> high confidence + the right Studio", () => {
  const r = routeIntent("I want to pay off my loan sooner");
  assert.equal(r.confidence, "high");
  assert.equal(r.pick.id, "loan");
  assert.equal(r.pick.screen, "repaymentPath");
});

test("routeIntent: an ambiguous message -> low/medium confidence + up to 3 options, never auto-picks blindly", () => {
  const r = routeIntent("I want to protect my family and also invest for retirement");
  assert.notEqual(r.confidence, "high");
  assert.ok(r.matches.length >= 2 && r.matches.length <= 3);
});

test("routeIntent: empty / unmatched input never routes anywhere", () => {
  assert.equal(routeIntent("").confidence, "empty");
  const r = routeIntent("the weather is pleasant this afternoon");
  assert.ok(!r.pick, "no Studio picked");
  assert.equal(r.matches.length, 0);
  assert.equal(r.confidence, "none");
});

test("routeIntent: a feeling ('everything is too tight each month') routes via a category hint, not silence", () => {
  const r = routeIntent("everything is too much every month");
  assert.equal(r.confidence, "low");
  assert.ok(r.matches.length >= 1);
  assert.ok(r.category);
});

test("every INTENT_ROUTES entry has a screen, a label key and a why key", () => {
  for (const route of INTENT_ROUTES) {
    assert.ok(route.screen && route.labelKey?.startsWith("explore.") && route.whyKey?.startsWith("explore."));
  }
});
