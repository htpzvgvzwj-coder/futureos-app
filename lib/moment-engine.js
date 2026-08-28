// Real Moment detection - the first concrete implementation of "the system
// surfaces what changed" instead of "the user opens a tool". A Moment is
// never AI-invented: every field here is computed from real stored data
// (a confirmed goal plan, real logged progress check-ins, real
// expense_entries history) or the function returns null when the data to
// honestly support a Moment doesn't exist yet - same "insufficient data
// excluded, never guessed" discipline as every other *-finance.js module
// in this codebase. Pure functions only, no DB/AI - the API route
// (app/api/moments/route.js) is what fetches the real inputs.

import { FIRST_HOME_DOWN_PAYMENT_RATE, computeReadyDateForMonthlyAmount } from "./home-draft-finance.js";
import { computeExpenseTrend } from "./expense-finance.js";

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function addMonths(monthStr, count) {
  const [year, month] = monthStr.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year, month - 1 + count, 1)));
}

function monthsBetween(fromMonth, toMonth) {
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

const MIN_LOGGED_MONTHS = 1;
// How far ahead the buffer-impact estimate looks - a disclosed assumption
// (surfaced in the reason copy), not a permanent claim. 12 months is the
// same horizon this codebase already treats as "a year of this pace" in
// income/expense trend framing elsewhere.
const BUFFER_IMPACT_HORIZON_MONTHS = 12;

// Detects a real slip in the customer's already-confirmed home down-
// payment savings plan: real logged check-ins falling short of the real
// committed monthly_contribution, recomputed forward to a real delay in
// months. Requires at least one real logged check-in in an elapsed month -
// with zero check-ins there's no real progress signal to compare against,
// so this returns null rather than guessing from the plan alone.
export function computeHomeGoalShiftMoment({ confirmedPlan, confirmedSavingsPlan, savingsCheckins, currentSavings, expenseHistory, monthlyExpenses, now = new Date() }) {
  if (!confirmedPlan || !confirmedSavingsPlan) return null;

  const { start_month: startMonth, monthly_contribution: monthlyContribution, target_complete_month: originalTargetMonth } = confirmedSavingsPlan;
  const currentMonth = monthKey(now);
  const monthsElapsed = monthsBetween(startMonth, currentMonth);
  if (monthsElapsed < MIN_LOGGED_MONTHS) return null;

  const elapsedMonths = [];
  for (let i = 0; i < monthsElapsed; i += 1) elapsedMonths.push(addMonths(startMonth, i));

  const checkinsByMonth = new Map((savingsCheckins ?? []).map((entry) => [entry.checkin_month, Number(entry.amount)]));
  const loggedElapsedMonths = elapsedMonths.filter((month) => checkinsByMonth.has(month));
  if (loggedElapsedMonths.length === 0) return null;

  const actualCumulative = loggedElapsedMonths.reduce((sum, month) => sum + checkinsByMonth.get(month), 0);
  const expectedCumulative = monthlyContribution * loggedElapsedMonths.length;
  if (expectedCumulative - actualCumulative <= 0) return null; // on track or ahead - no moment

  const downPaymentNeeded = Math.round(confirmedPlan.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
  const effectiveMonthlyPace = Math.round(actualCumulative / loggedElapsedMonths.length);

  const projectedAtOriginalPace = computeReadyDateForMonthlyAmount({ downPaymentNeeded, currentSavings, monthlyAmount: monthlyContribution });
  if (projectedAtOriginalPace.monthsToReady == null) return null; // original pace itself no longer projects to a date - not a "delay" this Moment can honestly express

  const projectedAtCurrentPace = computeReadyDateForMonthlyAmount({ downPaymentNeeded, currentSavings, monthlyAmount: effectiveMonthlyPace });
  const delayMonths = projectedAtCurrentPace.monthsToReady == null ? null : projectedAtCurrentPace.monthsToReady - projectedAtOriginalPace.monthsToReady;
  if (delayMonths != null && !(delayMonths > 0)) return null;

  const trend = computeExpenseTrend(expenseHistory);
  const reasonCode = trend.hasEnoughHistory && trend.direction === "up" ? "expense_increase" : "behind_pace";

  // Real "catch-up" amount: the monthly contribution needed, starting NOW,
  // to still hit the ORIGINAL confirmed target month - not a re-derived
  // date, the actual date the customer already committed to. null when
  // that date has already passed (honest - can't catch up to a past date)
  // or the shortfall is already covered.
  const monthsToOriginalTarget = originalTargetMonth ? monthsBetween(currentMonth, originalTargetMonth) : null;
  const shortfallNow = downPaymentNeeded - currentSavings;
  const catchUpAmount = monthsToOriginalTarget > 0 && shortfallNow > 0 ? Math.round(shortfallNow / monthsToOriginalTarget) : null;

  // Real cross-goal tradeoff: the incremental amount catching up would
  // divert from growing the emergency buffer, expressed as a real
  // buffer-months reduction over BUFFER_IMPACT_HORIZON_MONTHS - the exact
  // "adjust one thing, see the real impact on another goal" the product
  // audit asked for, not a generic warning.
  let bufferImpactMonths = null;
  if (catchUpAmount != null && monthlyExpenses > 0) {
    const incremental = Math.max(0, catchUpAmount - effectiveMonthlyPace);
    bufferImpactMonths = Math.round(((incremental * BUFFER_IMPACT_HORIZON_MONTHS) / monthlyExpenses) * 10) / 10;
  }

  return {
    id: "home-goal-shift",
    type: "change",
    priority: Math.min(100, 50 + (delayMonths ?? 20) * 5),
    relatedGoal: "home",
    visualType: "goal-timeline",
    reasonCode,
    reasonParams: reasonCode === "expense_increase" ? { changeAmount: trend.changeAmount, changePercent: trend.changePercent } : {},
    data: {
      delayMonths,
      downPaymentNeeded,
      currentSavings,
      effectiveMonthlyPace,
      originalMonthlyContribution: monthlyContribution,
      originalTargetMonth,
      catchUpAmount,
      bufferImpactMonths,
      bufferImpactHorizonMonths: BUFFER_IMPACT_HORIZON_MONTHS,
      sliderMin: Math.max(0, Math.round(effectiveMonthlyPace * 0.8)),
      sliderMax: Math.round(Math.max(monthlyContribution, catchUpAmount ?? 0) * 1.3),
    },
    primaryAction: "adopt_new_pace",
    secondaryAction: "keep_current_plan",
    status: "unseen",
  };
}

// Phase 3 of the same vertical: a real "you caught up" result, closing the
// prediction -> execution -> real result loop. Only fires once real logged
// check-ins since a real structured commitment (lib/goal-commitment-store.js)
// show the customer is genuinely back on or ahead of THAT commitment's pace
// - never announces recovery from the commitment amount alone, since a
// commitment existing doesn't mean it was actually followed.
export function computeHomeGoalRecoveryMoment({ commitment, confirmedPlan, savingsCheckins, currentSavings, now = new Date() }) {
  if (!commitment || !confirmedPlan) return null;

  const currentMonth = monthKey(now);
  const monthsSinceCommitment = monthsBetween(commitment.effective_month, currentMonth);
  if (monthsSinceCommitment < MIN_LOGGED_MONTHS) return null;

  const elapsedMonths = [];
  for (let i = 0; i < monthsSinceCommitment; i += 1) elapsedMonths.push(addMonths(commitment.effective_month, i));
  const checkinsByMonth = new Map((savingsCheckins ?? []).map((entry) => [entry.checkin_month, Number(entry.amount)]));
  const loggedMonths = elapsedMonths.filter((month) => checkinsByMonth.has(month));
  if (loggedMonths.length === 0) return null;

  const actualCumulative = loggedMonths.reduce((sum, month) => sum + checkinsByMonth.get(month), 0);
  const expectedCumulative = Number(commitment.monthly_contribution) * loggedMonths.length;
  if (actualCumulative < expectedCumulative) return null; // not yet actually recovered - stay silent rather than nag

  const priorPace = commitment.source_moment?.data?.effectiveMonthlyPace;
  if (!(priorPace > 0)) return null;

  const downPaymentNeeded = Math.round(confirmedPlan.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
  const projectedAtPriorPace = computeReadyDateForMonthlyAmount({ downPaymentNeeded, currentSavings, monthlyAmount: priorPace });
  const projectedAtNewPace = computeReadyDateForMonthlyAmount({
    downPaymentNeeded,
    currentSavings,
    monthlyAmount: Number(commitment.monthly_contribution),
  });
  if (projectedAtPriorPace.monthsToReady == null || projectedAtNewPace.monthsToReady == null) return null;

  const recoveredMonths = projectedAtPriorPace.monthsToReady - projectedAtNewPace.monthsToReady;
  if (!(recoveredMonths > 0)) return null;

  const originalTargetMonth = commitment.source_moment?.data?.originalTargetMonth ?? null;
  const monthsToOriginalTarget = originalTargetMonth ? monthsBetween(currentMonth, originalTargetMonth) : null;
  const remainingGapMonths =
    monthsToOriginalTarget != null ? Math.max(0, projectedAtNewPace.monthsToReady - monthsToOriginalTarget) : null;

  return {
    id: "home-goal-recovery",
    type: "progress",
    priority: 70,
    relatedGoal: "home",
    visualType: "goal-timeline",
    data: { recoveredMonths, remainingGapMonths, readyMonth: projectedAtNewPace.readyMonth },
    primaryAction: null,
    secondaryAction: "acknowledge",
    status: "unseen",
  };
}

// app/api/moments/route.js and future Moment types (income drop,
// emergency-fund shortfall, investment readiness, joint-goal decisions -
// see the migration plan) never need frontend changes to add a new
// source, only a new detector pushed into this list.
export function computeMoments({ home }) {
  const moments = [computeHomeGoalShiftMoment(home), computeHomeGoalRecoveryMoment(home)].filter(Boolean);
  moments.sort((a, b) => b.priority - a.priority);
  return moments.slice(0, 3);
}
