import test from "node:test";
import assert from "node:assert/strict";
import { computeWeddingPlanFinance } from "../lib/wedding/plan-finance.js";
import { projectWeddingBranchImpact } from "../lib/wedding/cross-goal-projection.js";

const reality = {
  wedding_date: "2027-06",
  guest_count: 150,
  venue_tier: "mid_range",
  venue_type: "hotel",
  total_budget: null,
  monthly_contribution: 900,
  partner_contribution: 0,
  current_savings: 15000,
};

const context = {
  monthlyIncome: 8000,
  monthlyExpenses: 4200,
  committedExcludingWedding: 600,
  emergencyBufferMonths: 7.5,
  home: { monthlyContribution: 900, downPaymentNeeded: 150000, currentSavings: 40000 },
};

function project(branchOverrides) {
  const branchData = { ...reality, ...branchOverrides };
  return projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: branchData }),
    realityFinance: computeWeddingPlanFinance({ planData: reality }),
    context,
  });
}

test("150 -> 90 guests: wedding total down, cashflow freed, Home deposit earlier, Emergency not worse", () => {
  const impact = project({ guest_count: 90 });

  assert.ok(impact.wedding.totalAfter < impact.wedding.totalBefore, "real banquet total drops");
  assert.ok(impact.wedding.userMonthlyAfter < impact.wedding.userMonthlyBefore, "user's required monthly drops");
  assert.ok(impact.cashflow.freed > 0, "cashflow is freed");
  assert.ok(impact.cashflow.after > impact.cashflow.before);

  assert.ok(impact.home, "home node is projected");
  assert.ok(impact.home.monthsDelta <= 0, "home deposit is the same or earlier, never later");
  assert.equal(impact.home.direction === "later", false);

  assert.ok(impact.emergency.bufferAfter >= impact.emergency.bufferBefore, "emergency buffer does not fall");
  assert.ok(impact.affectedCommitments.some((c) => c.goal === "home") || impact.home.monthsDelta === 0);
});

test("bigger wedding (200 guests) pushes Home later and can pressure Emergency", () => {
  const impact = project({ guest_count: 200, total_budget: 90000 });
  assert.ok(impact.wedding.userMonthlyAfter > impact.wedding.userMonthlyBefore);
  assert.ok(impact.cashflow.freed < 0, "this branch costs more, not less");
  assert.ok(impact.home.monthsDelta >= 0, "home deposit is the same or later");
});

test("partner contribution reduces the user's cross-goal footprint", () => {
  const solo = project({ guest_count: 150 });
  const shared = project({ guest_count: 150, partner_contribution: 500 });
  assert.ok(shared.wedding.userMonthlyAfter < solo.wedding.userMonthlyAfter);
  assert.ok(shared.cashflow.after >= solo.cashflow.after);
});

test("projection returns confidence + assumptions, never a bare number", () => {
  const impact = project({ guest_count: 100 });
  assert.ok(["low", "medium", "high"].includes(impact.confidence));
  assert.ok(Array.isArray(impact.assumptions) && impact.assumptions.length >= 2);
});

test("no income data -> lower confidence, cashflow before/after null, no invented figures", () => {
  const impact = projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: { ...reality, guest_count: 90 } }),
    realityFinance: computeWeddingPlanFinance({ planData: reality }),
    context: { ...context, monthlyIncome: 0 },
  });
  assert.equal(impact.cashflow.before, null);
  assert.equal(impact.cashflow.after, null);
  assert.equal(impact.confidence, "low");
});
