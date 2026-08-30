// Travel Living Plan - trip cost + funding (pure, no DB/AI).
//
// A trip is a life window, not a budget sheet. This sizes it from reference
// rates (never a vendor quote), splits the funding across current savings +
// monthly contribution + a deposit/balance schedule against the trip month,
// and - like Wedding - refuses to let a budget ceiling below the real cost
// count as "sealable".

import { computeReadyDateForMonthlyAmount } from "../home-draft-finance.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Reference nightly cost per traveller (accommodation + food + local) and a
// per-traveller flight/transport figure, by destination type x comfort.
const NIGHTLY_RATE = {
  domestic: { budget: 90, mid: 160, premium: 320 },
  regional: { budget: 130, mid: 240, premium: 480 },
  longhaul: { budget: 180, mid: 340, premium: 720 },
};
const FLIGHT_RATE = {
  domestic: { budget: 80, mid: 160, premium: 400 },
  regional: { budget: 250, mid: 480, premium: 1100 },
  longhaul: { budget: 900, mid: 1600, premium: 4200 },
};
const FIXED_TRIP_COST = 250; // visas, insurance, misc, per trip

function tier(t) {
  return t === "budget" || t === "premium" ? t : "mid";
}
function dest(d) {
  return d === "domestic" || d === "longhaul" ? d : "regional";
}

export function computeTravelPlanFinance({ planData, now = new Date() }) {
  const travellers = num(planData.travellers);
  const nights = num(planData.nights);
  if (!(travellers > 0) || !(nights > 0)) return { available: false, reason: "missing_trip_shape" };

  const d = dest(planData.destination_type);
  const c = tier(planData.comfort_tier);
  const nightly = NIGHTLY_RATE[d][c];
  const flight = FLIGHT_RATE[d][c];

  const accommodationAndLiving = nightly * travellers * nights;
  const flights = flight * travellers;
  const computedCoreTotal = Math.round(accommodationAndLiving + flights + FIXED_TRIP_COST);

  const userBudgetCeiling = num(planData.total_budget) > 0 ? num(planData.total_budget) : null;
  const planTotal = userBudgetCeiling != null ? Math.max(userBudgetCeiling, computedCoreTotal) : computedCoreTotal;
  const budgetGap = userBudgetCeiling != null ? Math.max(0, computedCoreTotal - userBudgetCeiling) : 0;
  const feasible = budgetGap === 0;

  const lineItems = [
    { category: "flights", label: "Flights / transport", subtotal: Math.round(flights) },
    { category: "accommodation", label: `Accommodation + food (${nights} nights x ${travellers})`, subtotal: Math.round(accommodationAndLiving) },
    { category: "fixed", label: "Visas, insurance, misc", subtotal: FIXED_TRIP_COST },
  ];
  const unresolvedItems = feasible ? [] : [...lineItems].sort((a, b) => b.subtotal - a.subtotal);

  // Payment schedule: a deposit now to hold flights/stay, the balance a
  // month before the trip.
  const tripMonth = /^\d{4}-\d{2}/.test(String(planData.trip_month ?? "")) ? String(planData.trip_month).slice(0, 7) : null;
  let monthsUntilBalance = null;
  const schedule = [];
  if (tripMonth) {
    const [ty, tm] = tripMonth.split("-").map(Number);
    const balanceIdx = ty * 12 + (tm - 1) - 1; // one month before
    const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
    monthsUntilBalance = Math.max(1, balanceIdx - nowIdx);
    schedule.push({ id: "deposit", label: "Deposit (holds flights + stay)", amount: Math.round(planTotal * 0.3), dueMonth: now.toISOString().slice(0, 7) });
    schedule.push({ id: "balance", label: "Balance (before the trip)", amount: Math.round(planTotal * 0.7), dueMonth: `${String(Math.floor(balanceIdx / 12)).padStart(4, "0")}-${String((balanceIdx % 12) + 1).padStart(2, "0")}` });
  }

  const currentSavings = num(planData.current_savings);
  const totalShortfall = Math.max(0, planTotal - currentSavings);
  const userMonthly = num(planData.monthly_contribution);
  const requiredMonthly = monthsUntilBalance ? Math.ceil(totalShortfall / monthsUntilBalance) : null;

  // Also expose a home-style ready projection for the Future Field time axis.
  const readyProj = computeReadyDateForMonthlyAmount({ downPaymentNeeded: planTotal, currentSavings, monthlyAmount: userMonthly });

  return {
    available: true,
    computedCoreTotal,
    userBudgetCeiling,
    planTotal,
    budgetGap,
    feasible,
    sealable: feasible,
    planStage: feasible ? "ready" : "needs_changes",
    unresolvedItems,
    lineItems,
    perTraveller: travellers ? Math.round(planTotal / travellers) : null,
    paymentSchedule: schedule,
    monthsUntilBalance,
    totalShortfall,
    userMonthly,
    userRequiredMonthly: requiredMonthly,
    monthsToReady: readyProj.monthsToReady,
    readyMonth: readyProj.readyMonth,
    onPace: requiredMonthly != null ? userMonthly >= requiredMonthly : null,
  };
}
