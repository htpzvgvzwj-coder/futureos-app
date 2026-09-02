// Calendar Orbit - the Travel Studio's flagship domain finance engine (pure).
//
// A trip is a point on a 12-month orbit, not a budget row. The engine sizes
// the trip from reference rates (never a fare or hotel quote), layers a
// TRANSPARENT seasonality band on top (shown, never hidden in a score),
// then works the funding backwards from the trip month: a deposit now, the
// balance one month before, and a required monthly pace across the funding
// window. Every figure is a RANGE with a stated, dated assumption. A budget
// ceiling below the real cost is NOT sealable; unknown savings / income
// stay unknown (FOG) and the funding is simply not computed.

import { computeTravelPlanFinance } from "./plan-finance.js";
import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value), provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}
function monthKeyToParts(m) {
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return null;
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  return { y, mo, idx: y * 12 + (mo - 1), int: y * 100 + mo };
}

// Transparent seasonality. Singapore school holidays + regional peaks push
// the HIGH end of the band up and the expected up a little; the customer
// sees the multiplier, it is never buried.
const SEASON = {
  1: "shoulder", 2: "off", 3: "shoulder", 4: "off", 5: "off", 6: "peak",
  7: "shoulder", 8: "off", 9: "off", 10: "off", 11: "shoulder", 12: "peak",
};
const SEASON_MULT = {
  peak: { expected: 1.12, high: 1.32 },
  shoulder: { expected: 1.04, high: 1.18 },
  off: { expected: 1.0, high: 1.15 },
};
export function seasonFor(monthNum) {
  const key = SEASON[monthNum] ?? "off";
  return { key, expectedMult: SEASON_MULT[key].expected, highMult: SEASON_MULT[key].high };
}

// planData: {
//   travellers, nights, destination_type, comfort_tier, trip_month,
//   total_budget, monthly_contribution, current_savings,
//   latest_trip_month?          (YYYYMM int Pin)
//   minimum_current_breathing_room?
// }
// context: { monthlyIncome, monthlyExpenses, otherGoalsMonthlyOutflow,
//   currentSavings?, emergencyBufferMonths?, now? }
export function computeCalendarOrbit({ planData = {}, context = {}, now }) {
  const asOfNow = now ?? context.now ?? new Date();
  const core = computeTravelPlanFinance({ planData, now: asOfNow });
  if (!core.available) return { available: false, reason: core.reason ?? "missing_trip_shape" };

  const tripParts = monthKeyToParts(planData.trip_month);
  const nowIdx = asOfNow.getUTCFullYear() * 12 + asOfNow.getUTCMonth();
  const monthsUntilTrip = tripParts ? tripParts.idx - nowIdx : null;
  const fundingWindow = monthsUntilTrip != null ? Math.max(1, monthsUntilTrip - 1) : null;
  const tripMonthNum = tripParts ? tripParts.mo : null;
  const balanceIdx = tripParts ? tripParts.idx - 1 : null;
  const balanceMonthNum = balanceIdx != null ? ((balanceIdx % 12) + 12) % 12 + 1 : null;
  const season = tripMonthNum ? seasonFor(tripMonthNum) : seasonFor(asOfNow.getUTCMonth() + 1);

  // Trip cost RANGE = reference core cost x transparent seasonality band.
  const base = core.computedCoreTotal;
  const tripCostRange = {
    low: Math.round(base * 0.88),
    expected: Math.round(base * season.expectedMult),
    high: Math.round(base * season.highMult * 1.15),
  };

  const userBudgetCeiling = num(planData.total_budget) > 0 ? num(planData.total_budget) : null;
  const planTotal = userBudgetCeiling != null ? Math.max(userBudgetCeiling, tripCostRange.expected) : tripCostRange.expected;
  const budgetGap = userBudgetCeiling != null ? Math.max(0, tripCostRange.expected - userBudgetCeiling) : 0;
  const feasible = budgetGap === 0;

  // Funding is worked backwards from the trip month. Unknown earmarked
  // savings -> FOG, the funding is not computed and never drawn as a risk.
  const savingsRaw = context.currentSavings != null ? context.currentSavings : planData.current_savings;
  const earmarkedKnown = savingsRaw != null && Number.isFinite(Number(savingsRaw));
  const earmarked = earmarkedKnown ? Math.min(Math.max(0, num(savingsRaw)), planTotal) : null;
  const monthly = Math.max(0, num(planData.monthly_contribution));

  const fundedByBalance = earmarked != null && fundingWindow != null ? earmarked + monthly * fundingWindow : null;
  const fundingShortfall = fundedByBalance != null ? Math.max(0, planTotal - fundedByBalance) : null;
  const requiredMonthly = earmarked != null && fundingWindow != null && fundingWindow > 0
    ? Math.ceil(Math.max(0, planTotal - earmarked) / fundingWindow)
    : null;
  const fundedFraction = fundedByBalance != null && planTotal > 0 ? Math.min(1, Math.round((fundedByBalance / planTotal) * 100) / 100) : null;
  const onPace = requiredMonthly != null ? monthly >= requiredMonthly : null;
  const paceState = requiredMonthly == null ? "unknown"
    : monthly >= Math.ceil(requiredMonthly * 1.1) ? "ahead"
    : monthly >= requiredMonthly ? "on_track"
    : "short";

  const income = num(context.monthlyIncome);
  const currentBreathingRoomAfter = income > 0
    ? Math.round(income - num(context.monthlyExpenses) - num(context.otherGoalsMonthlyOutflow) - monthly)
    : null;
  const liquidityConflict = currentBreathingRoomAfter != null && currentBreathingRoomAfter < 0;
  const minBreathing = num(planData.minimum_current_breathing_room, 0);
  const belowBreathing = currentBreathingRoomAfter != null && currentBreathingRoomAfter < minBreathing;

  const latestTripMonth = num(planData.latest_trip_month) > 0 ? num(planData.latest_trip_month) : null;
  const tripMonthInt = tripParts ? tripParts.int : null;
  const pastLatest = latestTripMonth != null && tripMonthInt != null && tripMonthInt > latestTripMonth;

  const windowOk = fundingWindow != null && fundingWindow >= 1;
  const sealable = feasible && windowOk && !liquidityConflict && !belowBreathing && !pastLatest;
  const sealableReason = !feasible ? "budget_below_real_cost"
    : !windowOk ? "trip_month_missing_or_too_soon"
    : liquidityConflict ? "contribution_exceeds_cashflow"
    : belowBreathing ? "below_current_breathing_room"
    : pastLatest ? "trip_slips_past_pinned_month"
    : "ok";

  const schedule = tripParts
    ? [
        { id: "deposit", label: "Deposit (holds flights + stay)", amount: Math.round(planTotal * 0.3), dueMonth: asOfNow.toISOString().slice(0, 7) },
        { id: "balance", label: "Balance (one month before the trip)", amount: Math.round(planTotal * 0.7), dueMonth: `${String(Math.floor(balanceIdx / 12)).padStart(4, "0")}-${String((balanceIdx % 12) + 1).padStart(2, "0")}` },
      ]
    : [];

  return {
    available: true,
    tripCostRange,
    perTravellerRange: core.perTraveller != null && num(planData.travellers) > 0
      ? { low: Math.round(tripCostRange.low / num(planData.travellers)), expected: Math.round(tripCostRange.expected / num(planData.travellers)), high: Math.round(tripCostRange.high / num(planData.travellers)) }
      : null,
    userBudgetCeiling,
    planTotal,
    budgetGap,
    feasible,
    lineItems: core.lineItems,
    unresolvedItems: core.unresolvedItems,
    season,
    tripMonthNum,
    tripMonthInt,
    nowMonthNum: asOfNow.getUTCMonth() + 1,
    balanceMonthNum,
    monthsUntilTrip,
    fundingWindow,
    paymentSchedule: schedule,
    earmarked: fig(earmarked, earmarkedKnown ? "bank_confirmed" : "unknown"),
    monthlyContribution: fig(monthly, planData.monthly_contribution != null ? "user_confirmed" : "system_estimate"),
    fundedByBalance: fig(fundedByBalance, earmarkedKnown ? "system_estimate" : "unknown"),
    fundingShortfall,
    requiredMonthly,
    fundedFraction,
    onPace,
    paceState,
    currentBreathingRoomAfter: fig(currentBreathingRoomAfter, income > 0 ? "system_estimate" : "unknown"),
    liquidityConflict,
    belowBreathing,
    pastLatest,
    sealable,
    sealableReason,
    assumptions: [
      { text: "Reference-rate estimate from Singapore, as of 2026-07 - not a fare or hotel quote", confidence: "low", asOf: "2026-07", region: "from Singapore" },
      { text: "30% deposit now / 70% balance one month before the trip", confidence: "high" },
      { text: "The +/-12-15% band is real seasonal and fare variance, never a fare prediction", confidence: "high" },
      season.key !== "off" ? { text: `${tripMonthNum ? "Trip month" : "This month"} is ${season.key} season - the high end carries a x${season.highMult} multiplier, shown here`, confidence: "medium" } : null,
      earmarkedKnown ? null : { text: "Earmarked savings not confirmed - the funding pace is shown as unknown, not zero", confidence: "high" },
    ].filter(Boolean),
    unknowns: [
      tripParts ? null : "trip_month",
      earmarkedKnown ? null : "current_savings",
      income > 0 ? null : "monthly_income",
    ].filter(Boolean),
  };
}

// Back-solve: the required monthly pace if the trip moved to a different
// month (a real Bend - a later month gives a longer funding window).
export function requiredMonthlyForTripMonth({ planData, context, tripMonth, now }) {
  const o = computeCalendarOrbit({ planData: { ...planData, trip_month: tripMonth }, context, now });
  if (!o.available) return null;
  return { tripMonth, requiredMonthly: o.requiredMonthly, fundingWindow: o.fundingWindow, planTotal: o.planTotal, season: o.season.key };
}
