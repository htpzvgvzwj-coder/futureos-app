import test from "node:test";
import assert from "node:assert/strict";
import { getFutureFieldAdapter, futureFieldSupportedDomains } from "../lib/future-field/adapters.js";
import { projectMonthlyShift, monthsToPayoff } from "../lib/living-plan/monthly-shift-projection.js";
import { peelBranch, solveMonthlyForTargetMonths } from "../lib/plan-runtime/index.js";

const loan = getFutureFieldAdapter("loan");
const retire = getFutureFieldAdapter("retirement");

const loanReality = {
  loan_amount: 40000,
  annual_rate_percent: 4.5,
  tenure_years: 7,
  monthly_installment: 555,
  extra_repayment: 0,
  monthly_income: 7000,
  monthly_expenses: 3800,
  current_savings: 25000,
  other_goals_monthly_outflow: 900,
};

const retireReality = {
  target_monthly_income: 3000,
  gap_monthly: 1200,
  monthly_contribution: 400,
  current_savings: 30000,
  monthly_income: 7000,
  monthly_expenses: 3800,
};

const ctx = {
  monthlyIncome: 7000,
  monthlyExpenses: 3800,
  committedExcludingDomain: 900,
  emergencyBufferMonths: 6.5,
  home: { monthlyContribution: 800, downPaymentNeeded: 140000, currentSavings: 40000 },
};

test("loan + retirement are registered Future Field domains", () => {
  const d = futureFieldSupportedDomains();
  assert.ok(d.includes("loan") && d.includes("retirement"));
});

test("monthsToPayoff: real reducing-balance math; null when payment can't cover interest", () => {
  assert.equal(monthsToPayoff({ principal: 0, annualRatePercent: 5, monthlyPayment: 100 }), 0);
  assert.equal(monthsToPayoff({ principal: 10000, annualRatePercent: 0, monthlyPayment: 500 }), 20);
  const m = monthsToPayoff({ principal: 40000, annualRatePercent: 4.5, monthlyPayment: 555 });
  assert.ok(m > 70 && m < 100, `got ${m}`);
  assert.equal(monthsToPayoff({ principal: 40000, annualRatePercent: 4.5, monthlyPayment: 100 }), null);
});

test("loan feasibility: months-to-debt-free, debt weight, monthly freedom, Future Score", () => {
  const f = loan.feasibility(loanReality);
  assert.equal(f.available, true);
  assert.ok(f.monthsToDebtFree > 0);
  assert.ok(f.debtWeight > 0 && f.debtWeight < 1);
  assert.ok(f.monthlyFreedom > 0);
  assert.ok(f.futureScore >= 0 && f.futureScore <= 100);
});

test("loan: extra repayment finishes sooner; the unified impactSet shows PRESSURE and a ghost Future Handoff", () => {
  const f0 = loan.feasibility(loanReality);
  const branch = { ...loanReality, extra_repayment: 300 };
  const f1 = loan.feasibility(branch);
  assert.ok(f1.monthsToDebtFree < f0.monthsToDebtFree, "extra repayment -> debt-free sooner");

  // Living Thread commit 4: projectImpacts now returns the studio-contract
  // impactSet (Debt Gravity), not the old monthly-shift shape.
  const impact = loan.projectImpacts(branch, loanReality, ctx);
  assert.equal(impact.resourceDelta.addedPressureMonthly, 300);
  assert.equal(impact.resourceDelta.freedMonthly, 0);
  assert.equal(impact.resourceDelta.futureHandoffAtPayoff.state, "ghost");
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.equal(impact.allocationRequired, true);
});

test("loan: reducing a prior extra repayment FREES cashflow; a leg is solid only once allocated", () => {
  const priorBranch = { ...loanReality, extra_repayment: 300 };
  const relaxed = { ...loanReality, extra_repayment: 100 };
  const impact = loan.projectImpacts(relaxed, priorBranch, ctx);
  assert.equal(impact.resourceDelta.freedMonthly, 200);
  assert.equal(impact.resourceDelta.addedPressureMonthly, 0);
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null), "possible only until allocated");

  const withAlloc = loan.projectImpacts({ ...relaxed, allocation: { goalMonthly: 200, emergencyMonthly: 0, flexibleMonthly: 0 } }, priorBranch, ctx);
  assert.notEqual(withAlloc.affectedGoals.find((g) => g.goalId === "home").confirmedAfter, null);
});

test("loan Bend: solve the extra repayment to be debt-free by a target month", () => {
  const projector = loan.projector(loanReality);
  const current = projector(0);
  const target = Math.max(6, Math.round(current * 0.6));
  const solved = solveMonthlyForTargetMonths({ targetMonths: target, projectMonthsFn: projector, highAmount: 5000 });
  assert.ok(solved.achievable === false || (solved.amount > 0 && solved.projectedMonths <= target));
});

test("retirement feasibility: monthly gap, nest-egg needed, years to close", () => {
  const f = retire.feasibility(retireReality);
  assert.equal(f.available, true);
  assert.equal(f.gapMonthly, 1200);
  assert.ok(f.nestEggNeeded > 0);
  assert.ok(f.monthsToCloseGap > 0);
  assert.ok(f.yearsToCloseGap > 0);
});

test("retirement: a HIGHER top-up closes the gap sooner; the unified impactSet shows PRESSURE and a gap RANGE", () => {
  const f0 = retire.feasibility(retireReality);
  const branch = { ...retireReality, monthly_contribution: 700 };
  const f1 = retire.feasibility(branch);
  assert.ok(f1.monthsToCloseGap < f0.monthsToCloseGap);
  // Living Thread commit 5: projectImpacts now returns the studio-contract
  // impactSet (Future-Day Loom), not the old monthly-shift shape.
  const impact = retire.projectImpacts(branch, retireReality, ctx);
  assert.equal(impact.resourceDelta.addedPressureMonthly, 300);
  assert.equal(impact.resourceDelta.freedMonthly, 0);
  assert.ok(impact.resourceDelta.gapMonthlyRangeAfter && impact.resourceDelta.gapMonthlyRangeAfter.low != null, "the gap is a range, never a point");
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  assert.equal(impact.allocationRequired, true);
});

test("retirement: a LOWER top-up frees cashflow; nothing moves without allocation", () => {
  const priorBranch = { ...retireReality, monthly_contribution: 700 };
  const relaxed = { ...retireReality, monthly_contribution: 400 };
  const impact = retire.projectImpacts(relaxed, priorBranch, ctx);
  assert.equal(impact.resourceDelta.freedMonthly, 300);
  assert.equal(impact.resourceDelta.addedPressureMonthly, 0);
  assert.ok(impact.affectedGoals.every((g) => g.confirmedAfter == null), "possible only until allocated");
  const placed = retire.projectImpacts({ ...relaxed, allocation: { goalMonthly: 300, emergencyMonthly: 0, flexibleMonthly: 0 } }, priorBranch, ctx);
  assert.notEqual(placed.affectedGoals.find((g) => g.goalId === "home").confirmedAfter, null);
});

test("generic projectMonthlyShift: neutral when the monthly is unchanged", () => {
  const p = projectMonthlyShift({ domain: "loan", monthlyBefore: 500, monthlyAfter: 500, context: ctx });
  assert.equal(p.mode, "neutral");
});

test("peelBranch works with the loan adapter's feasibility fn", () => {
  const out = peelBranch({ baseData: loanReality, overrides: { extra_repayment: 200 }, feasibilityFn: (d) => loan.feasibility(d) });
  assert.deepEqual(out.delta.changedKeys, ["extra_repayment"]);
  assert.ok(out.feasibility.monthsToDebtFree < loan.feasibility(loanReality).monthsToDebtFree);
});
