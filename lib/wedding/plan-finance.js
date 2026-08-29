// Wedding Living Plan - financial semantics (pure, no DB/AI).
//
// The one place that answers, for a given wedding plan + the couple's real
// cashflow:
//   - what the core wedding actually costs (Singapore reference-rate
//     estimate, not a vendor quote)
//   - whether the user's budget ceiling can even cover that core
//   - how the shortfall splits between the two partners
//   - what monthly contribution the USER personally needs, vs the couple
//     combined
//   - whether this plan is allowed to be Sealed yet
//
// Partner contribution is a real financial input here, never a note.

import { computeCoreWeddingLineItems, computePaymentSchedule } from "../wedding-finance.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Normalise a wedding date that may arrive as "YYYY-MM" or "YYYY-MM-DD".
function toISODate(weddingDate) {
  const s = String(weddingDate ?? "");
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-15`;
  return s || null;
}

function monthsFromNow(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
}

// planData: {
//   wedding_date, guest_count, venue_tier, venue_type, photography_tier,
//   attire_tier, total_budget (user ceiling, optional),
//   monthly_contribution (user's own), partner_contribution (partner's own
//   committed monthly), current_savings (the user's earmarked savings)
// }
export function computeWeddingPlanFinance({ planData, now = new Date() }) {
  const guestCount = num(planData.guest_count);
  if (!(guestCount > 0)) {
    return { available: false, reason: "no_guest_count" };
  }

  const lineItems = computeCoreWeddingLineItems({
    guestCount,
    venueTier: planData.venue_tier ?? "mid_range",
    venueType: planData.venue_type ?? "hotel",
    photographyTier: planData.photography_tier ?? "mid_range",
    attireTier: planData.attire_tier ?? "mid_range",
  });
  const computedCoreTotal = lineItems.reduce((s, li) => s + (li.subtotal || 0), 0);

  // The user's ceiling does NOT silently override the core cost. If it is
  // set and below core, the plan carries a real gap and cannot be Sealed.
  const userBudgetCeiling = num(planData.total_budget) > 0 ? num(planData.total_budget) : null;
  const planTotal = userBudgetCeiling != null ? Math.max(userBudgetCeiling, computedCoreTotal) : computedCoreTotal;
  const budgetGap = userBudgetCeiling != null ? Math.max(0, computedCoreTotal - userBudgetCeiling) : 0;
  const feasible = budgetGap === 0;

  // Which line items are the ones the customer would have to cut / change
  // to close the gap - largest first, so the UI can point at "the venue"
  // rather than a number.
  const unresolvedItems = feasible
    ? []
    : [...lineItems]
        .sort((a, b) => (b.subtotal || 0) - (a.subtotal || 0))
        .map((li) => ({ category: li.category, label: li.label, subtotal: li.subtotal }));

  // Payment schedule + the balance-due horizon that the required monthly is
  // sized against.
  const weddingISO = toISODate(planData.wedding_date);
  let paymentSchedule = [];
  try {
    paymentSchedule = weddingISO ? computePaymentSchedule(planTotal, weddingISO, now.toISOString()) : [];
  } catch {
    paymentSchedule = [];
  }
  const monthsUntilBalance = paymentSchedule.length
    ? monthsFromNow(paymentSchedule[paymentSchedule.length - 1].dueDate, now)
    : monthsFromNow(weddingISO, now);

  // Shortfall = what still has to be saved on top of the user's earmarked
  // savings. Partner's earmarked savings are deliberately NOT folded in
  // here - Blind Merge keeps each side's balances private; only the
  // partner's committed MONTHLY contribution is shared.
  const currentSavings = num(planData.current_savings);
  const totalShortfall = Math.max(0, planTotal - currentSavings);

  const partnerMonthly = num(planData.partner_contribution);
  const partnerCommittedTotal = monthsUntilBalance ? partnerMonthly * monthsUntilBalance : 0;
  // The partner covers up to their committed run of monthly contributions;
  // whatever is left is the user's personal shortfall.
  const userPersonalShortfall = Math.max(0, totalShortfall - partnerCommittedTotal);

  const userRequiredMonthly = monthsUntilBalance ? Math.ceil(userPersonalShortfall / monthsUntilBalance) : null;
  const combinedRequiredMonthly = monthsUntilBalance ? Math.ceil(totalShortfall / monthsUntilBalance) : null;

  const userMonthly = num(planData.monthly_contribution);
  const onPace = userRequiredMonthly != null ? userMonthly >= userRequiredMonthly : null;

  return {
    available: true,
    computedCoreTotal,
    userBudgetCeiling,
    planTotal,
    budgetGap,
    feasible,
    unresolvedItems,
    lineItems,
    paymentSchedule,
    monthsUntilBalance,
    currentSavings,
    totalShortfall,
    partnerMonthly,
    partnerCommittedTotal,
    userPersonalShortfall,
    userRequiredMonthly,
    combinedRequiredMonthly,
    userMonthly,
    onPace,
    // A plan can only be Sealed when its budget actually covers the core
    // cost. Below-core plans stay in Exploring / Needs Changes.
    sealable: feasible,
    planStage: feasible ? "ready" : "needs_changes",
  };
}
