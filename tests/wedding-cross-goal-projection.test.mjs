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

function project(branchOverrides, allocation = null) {
  const branchData = { ...reality, ...branchOverrides };
  return projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: branchData }),
    realityFinance: computeWeddingPlanFinance({ planData: reality }),
    context,
    allocation,
  });
}

test("150 -> 90 frees cashflow; with NO allocation the Home deposit is NOT moved", () => {
  const p = project({ guest_count: 90 });
  assert.equal(p.mode, "freed");
  assert.ok(p.freedCashflow > 0, "money is freed");
  assert.equal(p.allocatedImpact, null, "nothing allocated -> no allocatedImpact");
  // availableImpact shows what COULD happen, framed as a possibility
  assert.ok(p.availableImpact.maxHomeMonthsEarlier > 0, "could bring home earlier");
  assert.equal(p.availableImpact.note, "possible_not_committed");
  assert.equal(p.availableImpact.unallocated, p.freedCashflow, "all of it is still available");
  // the "current" home/emergency layer is unchanged
  assert.equal(p.emergency.direction, "flat");
});

test("allocate ALL freed cashflow to Home -> Home deposit moves earlier, Emergency unchanged", () => {
  const freed = project({ guest_count: 90 }).freedCashflow;
  const p = project({ guest_count: 90 }, { goalMonthly: freed, emergencyMonthly: 0, flexibleMonthly: 0 });
  assert.ok(p.allocatedImpact, "allocatedImpact present once allocated");
  assert.ok(p.allocatedImpact.home.monthsDelta < 0, "home ready date earlier");
  assert.equal(p.allocatedImpact.emergency.direction, "flat", "emergency untouched");
  assert.equal(p.allocatedImpact.flexible.added, 0);
});

test("allocate ALL freed cashflow to Emergency -> buffer rises, Home unchanged", () => {
  const freed = project({ guest_count: 90 }).freedCashflow;
  const p = project({ guest_count: 90 }, { goalMonthly: 0, emergencyMonthly: freed, flexibleMonthly: 0 });
  assert.equal(p.allocatedImpact.home.monthsDelta, 0, "home unchanged");
  assert.ok(p.allocatedImpact.emergency.bufferAfter > p.allocatedImpact.emergency.bufferBefore, "buffer rises");
  assert.equal(p.allocatedImpact.emergency.direction, "up");
});

test("Split allocation only moves the legs the customer set", () => {
  const freed = project({ guest_count: 90 }).freedCashflow;
  const half = Math.floor(freed / 2);
  const p = project({ guest_count: 90 }, { goalMonthly: half, emergencyMonthly: 0, flexibleMonthly: freed - half });
  assert.ok(p.allocatedImpact.home.monthsDelta < 0, "home leg moved");
  assert.equal(p.allocatedImpact.emergency.direction, "flat", "emergency leg not set -> not moved");
  assert.ok(p.allocatedImpact.flexible.added > 0, "flexible leg added");
});

test("a costlier branch (200 guests) returns pressure, no allocation layer", () => {
  const p = project({ guest_count: 200, total_budget: 90000 });
  assert.equal(p.mode, "pressure");
  assert.ok(p.pressure.extraMonthlyNeeded > 0);
  assert.equal(p.availableImpact, null);
  assert.equal(p.allocatedImpact, null);
});

test("partner contribution reduces the freed amount's origin but Allocation still governs where it goes", () => {
  const solo = project({ guest_count: 90 });
  const shared = project({ guest_count: 90, partner_contribution: 300 });
  assert.ok(shared.wedding.userMonthlyAfter <= solo.wedding.userMonthlyAfter);
  assert.equal(shared.allocatedImpact, null, "still nothing auto-allocated");
});

test("no income -> lower confidence, cashflow before/after null", () => {
  const p = projectWeddingBranchImpact({
    branchFinance: computeWeddingPlanFinance({ planData: { ...reality, guest_count: 90 } }),
    realityFinance: computeWeddingPlanFinance({ planData: reality }),
    context: { ...context, monthlyIncome: 0 },
  });
  assert.equal(p.cashflow.before, null);
  assert.equal(p.confidence, "low");
});

test("assumptions spell out that freed cashflow is NOT moved automatically", () => {
  const p = project({ guest_count: 90 });
  assert.ok(p.assumptions.some((a) => /not moved anywhere until you allocate/i.test(a)));
});
