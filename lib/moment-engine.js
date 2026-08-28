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

// Detects a real slip in the customer's already-confirmed home down-
// payment savings plan: real logged check-ins falling short of the real
// committed monthly_contribution, recomputed forward to a real delay in
// months. Requires at least one real logged check-in in an elapsed month -
// with zero check-ins there's no real progress signal to compare against,
// so this returns null rather than guessing from the plan alone.
export function computeHomeGoalShiftMoment({ confirmedPlan, confirmedSavingsPlan, savingsCheckins, currentSavings, expenseHistory, now = new Date() }) {
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
      sliderMin: Math.max(0, Math.round(effectiveMonthlyPace * 0.8)),
      sliderMax: Math.round(monthlyContribution * 1.3),
    },
    primaryAction: "adopt_new_pace",
    secondaryAction: "keep_current_plan",
    status: "unseen",
  };
}

// Only one Moment type exists so far (home-goal-shift) - this orchestrator
// exists now so app/api/moments/route.js and future Moment types (income
// drop, emergency-fund shortfall, investment readiness, joint-goal
// decisions - see the migration plan) never need frontend changes to add
// a new source, only a new detector pushed into this list.
export function computeMoments({ home }) {
  const moments = [computeHomeGoalShiftMoment(home)].filter(Boolean);
  moments.sort((a, b) => b.priority - a.priority);
  return moments.slice(0, 3);
}
