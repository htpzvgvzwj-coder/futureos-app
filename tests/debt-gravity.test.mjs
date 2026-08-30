import test from "node:test";
import assert from "node:assert/strict";
import { computeDebtGravity, strategyComparison, requiredExtraForPayoffMonth, amortize } from "../lib/loan/debt-gravity-finance.js";
import { projectDebtImpact } from "../lib/loan/debt-gravity-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const debts = [
  { id: "loan:home", label: "Home loan", kind: "loan", balance: 320000, annualRatePercent: 3.2, minimumMonthly: 1550, feeConfirmed: 0, provenance: "bank_confirmed" },
  { id: "card:primary", label: "Card", kind: "card", balance: 9000, annualRatePercent: 26, minimumMonthly: 270, feeConfirmed: 0, provenance: "user_confirmed" },
];
const ctx = { monthlyIncome: 9000, monthlyExpenses: 3800, otherGoalsMonthlyOutflow: 500, emergencyBufferMonths: 7, currentSavings: 40000 };
const planAt = (extra) => ({ target_debt: "card:primary", extra_monthly: extra, one_off_payment: 0, breathing_room_floor: 800 });

test("amortize: real reducing-balance totals; a payment below the interest never amortizes", () => {
  const s = amortize({ principal: 10000, annualRatePercent: 12, monthlyPayment: 500 });
  assert.ok(s.months > 0 && s.totalInterest > 0);
  assert.equal(amortize({ principal: 10000, annualRatePercent: 24, monthlyPayment: 100 }), null);
  assert.deepEqual(amortize({ principal: 0, annualRatePercent: 5, monthlyPayment: 100 }), { months: 0, totalInterest: 0 });
});

test("Gravity Body size is the confirmed balance; unknown APR / fee stay unknown", () => {
  const g = computeDebtGravity({ debts: [{ id: "x", label: "x", kind: "loan", balance: 5000, annualRatePercent: null, minimumMonthly: 200 }], planData: planAt(0), context: ctx });
  assert.equal(g.bodies[0].balance.value, 5000);
  assert.equal(g.bodies[0].balance.provenance, "bank_confirmed");
  assert.equal(g.bodies[0].annualRatePercent.value, null);
  assert.equal(g.bodies[0].annualRatePercent.provenance, "unknown");
  assert.equal(g.bodies[0].earlyRepaymentFee.provenance, "unknown");
  assert.ok(g.unknowns.some((u) => u.startsWith("apr:")));
});

test("SECTION M causal test: extra repayment -> earlier payoff, LESS current breathing room, a real Future Handoff (ghost)", () => {
  const r0 = computeDebtGravity({ debts, planData: planAt(0), context: ctx });
  const r1 = computeDebtGravity({ debts, planData: planAt(400), context: ctx });
  const card0 = r0.bodies.find((b) => b.id === "card:primary");
  const card1 = r1.bodies.find((b) => b.id === "card:primary");
  assert.ok(card1.monthsToPayoff < card0.monthsToPayoff, "payoff earlier");
  assert.ok(card1.monthsSaved > 0);
  assert.ok(r1.breathingRoom.value < r0.breathingRoom.value, "current breathing room drops");
  // Future Handoff is present but a GHOST before payoff
  assert.equal(r1.futureHandoffPreview.state, "ghost");
  assert.equal(r1.futureHandoffPreview.releasedMonthly, card1.minimumMonthly.value);
  assert.ok(/never auto-allocated/i.test(r1.futureHandoffPreview.note));

  const impact = projectDebtImpact({ branchPlan: planAt(400), realityPlan: planAt(0), debts, context: ctx });
  assert.equal(validateImpactSet(impact).ok, true);
  assert.equal(impact.resourceDelta.futureHandoffAtPayoff.state, "ghost");
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  for (const g of impact.affectedGoals) assert.equal(g.confirmedAfter, null, `${g.goalId} stays a ghost until allocated`);
  const placed = projectDebtImpact({ branchPlan: planAt(400), realityPlan: planAt(0), debts, context: ctx, allocation: { flexibleMonthly: 200 } });
  assert.notEqual(placed.affectedGoals[0].confirmedAfter, null);
});

test("Breathing Room Floor blocks over-repayment", () => {
  const g = computeDebtGravity({ debts, planData: { ...planAt(4500), breathing_room_floor: 1500 }, context: ctx });
  assert.equal(g.belowBreathingFloor, true);
  assert.equal(g.sealable, false);
  assert.equal(g.sealableReason, "below_breathing_room_floor");
});

test("requiredExtraForPayoffMonth back-solves the extra for a chosen Release Knot position", () => {
  const need12 = requiredExtraForPayoffMonth({ debt: debts[1], byMonths: 12 });
  const need6 = requiredExtraForPayoffMonth({ debt: debts[1], byMonths: 6 });
  assert.ok(need12 > 0 && need6 > need12, "a nearer payoff needs a bigger extra");
});

test("strategyComparison offers three real options with reasoning and never auto-picks", () => {
  const three = [
    ...debts,
    { id: "loan:reno", label: "Reno", kind: "loan", balance: 40000, annualRatePercent: 5.5, minimumMonthly: 800 },
  ];
  const sc = strategyComparison({ debts: three, extraBudget: 700, context: ctx });
  assert.ok(sc.options.highest_rate_first && sc.options.smallest_balance_first && sc.options.balanced);
  for (const o of Object.values(sc.options)) assert.ok(typeof o.reasoning === "string" && o.reasoning.length > 0);
  assert.ok(/you choose/i.test(sc.note));
});

test("loanAdapter carries the Gravity view, five domain pins, and a valid cross-goal impactSet", () => {
  const adapter = getFutureFieldAdapter("loan");
  const planData = { purpose: "home", loan_amount: 320000, annual_rate_percent: 3.2, monthly_installment: 1550, extra_repayment: 0, monthly_income: 9000, monthly_expenses: 3800, current_savings: 40000, other_goals_monthly_outflow: 500 };
  const f = adapter.feasibility(planData, { emergencyBufferMonths: 7 });
  assert.ok(f.gravity && f.gravity.available);
  const m = adapter.constraintMetrics(planData, f, { emergencyBufferMonths: 7 });
  assert.equal(typeof m.minimum_breathing_room, "number");
  assert.equal(m.maximum_extra_payment, 0);
  assert.equal(typeof m.protect_emergency_floor, "boolean");
  assert.equal(typeof m.no_one_off_from_protected_savings, "boolean");
  const impact = adapter.projectImpacts({ ...planData, extra_repayment: 600 }, planData, { emergencyBufferMonths: 7 }, null);
  assert.equal(validateImpactSet(impact).ok, true);
});
