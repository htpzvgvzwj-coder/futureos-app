import test from "node:test";
import assert from "node:assert/strict";
import { computeFutureLoom, buildFutureDay, requiredContributionForFutureDay, FUTURE_DAY_QUESTIONS } from "../lib/retirement/future-day-finance.js";
import { projectFutureDayImpact } from "../lib/retirement/future-day-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const ctx = { monthlyIncome: 7500, monthlyExpenses: 3800, otherGoalsMonthlyOutflow: 900, cpfLifeMonthly: 1400, existingRetirementAssets: 60000, emergencyBufferMonths: 6 };
const plan = (fd, contribution) => ({ future_day: fd, current_age: 40, future_age: 65, monthly_contribution: contribution });

test("buildFutureDay: one-question choices become a transparent RANGE, never a single number", () => {
  const d = buildFutureDay({ choices: { where: "overseas_higher_cost", housing: "renting" }, baseMonthlyLife: 3800, baseKnown: true });
  assert.ok(d.monthlyLifeRange.low < d.monthlyLifeRange.expected && d.monthlyLifeRange.expected < d.monthlyLifeRange.high);
  assert.equal(d.contributions.length, 2, "each non-zero choice is shown");
  assert.ok(d.contributions.every((c) => typeof c.monthlyDelta === "number"));
  assert.ok(d.assumptions.some((a) => /not a forecast/i.test(a.text)));
});

test("SECTION M causal test: a richer Future Day raises the gap/contribution range; current freedom drops; the RANGE is kept", () => {
  const bare = computeFutureLoom({ planData: plan({}, 500), context: ctx });
  const rich = computeFutureLoom({ planData: plan({ where: "overseas_higher_cost", housing: "renting", routine: "active_social" }, 500), context: ctx });
  assert.ok(rich.gapMonthlyRange.expected > bare.gapMonthlyRange.expected, "gap up");
  assert.ok(rich.requiredContributionRange.expected > bare.requiredContributionRange.expected, "required contribution up");
  // still a range, never collapsed to a point
  assert.ok(rich.requiredContributionRange.low < rich.requiredContributionRange.high);

  const lowContrib = computeFutureLoom({ planData: plan({}, 500), context: ctx });
  const highContrib = computeFutureLoom({ planData: plan({}, 2500), context: ctx });
  assert.ok(highContrib.currentBreathingRoomAfter.value < lowContrib.currentBreathingRoomAfter.value, "current freedom drops as the contribution rises");

  const impact = projectFutureDayImpact({ branchPlan: plan({}, 2500), realityPlan: plan({}, 500), context: ctx });
  assert.equal(validateImpactSet(impact).ok, true);
  assert.ok(impact.resourceDelta.gapMonthlyRangeAfter && impact.resourceDelta.gapMonthlyRangeAfter.low != null, "the impactSet carries the gap as a range");
  assert.ok(impact.affectedGoals.filter((g) => g.direction === "down").length >= 2);
  for (const g of impact.affectedGoals) assert.equal(g.confirmedAfter, null, "possible only until allocated");
});

test("NO investment return is assumed in the base; an optimistic band only appears with a stated assumption", () => {
  const base = computeFutureLoom({ planData: plan({}, 500), context: ctx });
  assert.equal(base.optimisticContribution, null, "no optimistic figure without an explicit assumption");
  assert.ok(base.assumptions.some((a) => /No investment return is assumed/i.test(a.text)));
  const withRr = computeFutureLoom({ planData: { ...plan({}, 500), real_return_assumption: 4 }, context: ctx });
  assert.ok(withRr.optimisticContribution && withRr.optimisticContribution.expected < base.requiredContributionRange.expected);
  assert.ok(/never a guarantee/i.test(withRr.optimisticContribution.note));
});

test("CPF LIFE / assets / inheritance: unknown unless confirmed, and inheritance is never counted", () => {
  const l = computeFutureLoom({ planData: plan({}, 500), context: { ...ctx, cpfLifeMonthly: null, existingRetirementAssets: null } });
  assert.equal(l.confirmedMonthlyIncome.value, 0);
  assert.equal(l.confirmedMonthlyIncome.provenance, "unknown");
  assert.ok(l.assumptions.some((a) => /No inheritance/i.test(a.text)));
  assert.ok(l.unknowns.includes("cpf_life_monthly"));
});

test("Open Future Band shows what future the customer can still choose, not just the gap", () => {
  const low = computeFutureLoom({ planData: plan({}, 200), context: ctx });
  const high = computeFutureLoom({ planData: plan({}, 4000), context: ctx });
  assert.ok(high.openFutureBand > low.openFutureBand, "a bigger contribution opens more future");
  assert.ok(low.openFutureBand >= 0 && high.openFutureBand <= 1);
});

test("Liquidity conflict blocks the Seal when the contribution exceeds available cashflow", () => {
  const l = computeFutureLoom({ planData: plan({}, 5000), context: ctx });
  assert.equal(l.liquidityConflict, true);
  assert.equal(l.sealable, false);
  assert.equal(l.sealableReason, "contribution_exceeds_cashflow");
});

test("requiredContributionForFutureDay is a range; there are six one-at-a-time questions", () => {
  const l = computeFutureLoom({ planData: plan({ housing: "renting" }, 500), context: ctx });
  const r = requiredContributionForFutureDay({ loom: l, byYears: 25 });
  assert.ok(r.low < r.expected && r.expected < r.high);
  assert.equal(FUTURE_DAY_QUESTIONS.length, 6);
});

test("retirementAdapter carries the Loom, the six domain pins, and a valid cross-goal impactSet", () => {
  const adapter = getFutureFieldAdapter("retirement");
  const pd = { target_monthly_income: 4000, gap_monthly: 2000, monthly_contribution: 600, current_savings: 30000, monthly_income: 7500, monthly_expenses: 3800 };
  const f = adapter.feasibility(pd, { emergencyBufferMonths: 6 });
  assert.ok(f.loom && f.loom.available);
  const m = adapter.constraintMetrics(pd, f, { emergencyBufferMonths: 6 });
  assert.equal(m.maximum_monthly_contribution, 600);
  assert.equal(typeof m.no_assumed_inheritance, "boolean");
  assert.equal(typeof m.no_unconfirmed_partner_assets, "boolean");
  const impact = adapter.projectImpacts({ ...pd, monthly_contribution: 1400 }, pd, { emergencyBufferMonths: 6 }, null);
  assert.equal(validateImpactSet(impact).ok, true);
});
