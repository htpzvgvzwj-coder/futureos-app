// Future Field domain adapters - each supplies the REAL feasibility
// calculator and the REAL forward projector for one domain, so the pure
// Future Field solvers (lib/plan-runtime/future-field.js) never invent
// numbers. Only domains with real deterministic math are registered; the
// route returns an honest "not available for this domain yet" otherwise.

import {
  computeHomeFinancials,
} from "../home-finance.js";
import {
  FIRST_HOME_DOWN_PAYMENT_RATE,
  computeReadyDateForMonthlyAmount,
} from "../home-draft-finance.js";
import { computeCoreWeddingLineItems, computePaymentSchedule } from "../wedding-finance.js";

// home: the reality path is the confirmed plan; a branch moves price / date
// / monthly amount; feasibility is the same MAS/IRAS pipeline the confirm
// route uses.
const homeAdapter = {
  domain: "home",
  // planData shape: { estimated_price, property_type, monthly_income,
  //   monthly_expenses, down_payment_needed, current_savings }
  feasibility(planData) {
    if (!(planData.estimated_price > 0)) return { available: false };
    const fin = computeHomeFinancials({
      price: planData.estimated_price,
      propertyType: planData.property_type ?? "hdb_resale",
      monthlyIncome: planData.monthly_income ?? 0,
      monthlyExpenses: planData.monthly_expenses ?? 0,
    });
    const downPaymentNeeded =
      planData.down_payment_needed ?? Math.round(planData.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
    return {
      available: true,
      ...fin,
      downPaymentNeeded,
      sources: ["Asset Profile ledger", "MAS/IRAS BSD/ABSD/TDSR/MSR tables", "confirmed home plan"],
      assumptions: [`${fin.affordability_limiting_factor} limited`, "3.5% rate, 25y tenure"],
    };
  },
  // months-to-ready for a given monthly savings amount, at this branch's
  // real down-payment target and current savings.
  projector(planData) {
    const downPaymentNeeded =
      planData.down_payment_needed ?? Math.round(planData.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
    return (monthlyAmount) =>
      computeReadyDateForMonthlyAmount({
        downPaymentNeeded,
        currentSavings: planData.current_savings ?? 0,
        monthlyAmount,
      }).monthsToReady;
  },
  // metrics used by Pin checking - map a constraint kind to the branch's
  // real current value for it.
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      max_delay_months: context.delayMonths ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
};

// wedding: the reality path is the confirmed budget + savings plan. Unlike
// home, the "date" here is the wedding date (a real fixed event), and the
// forward projector answers "how many months until the whole budget is
// funded at this monthly amount" - so Bend / solveMonthlyForTargetMonths
// solves the contribution needed to be fully funded by a chosen month, and
// Peel changing the wedding date recomputes the real payment schedule.
const weddingAdapter = {
  domain: "wedding",
  // planData shape: { wedding_date (YYYY-MM-DD or YYYY-MM), guest_count,
  //   venue_tier, venue_type, photography_tier, attire_tier, total_budget
  //   (user ceiling, optional), monthly_contribution, current_savings }
  feasibility(planData) {
    const guestCount = Number(planData.guest_count) || 0;
    if (!(guestCount > 0)) return { available: false };
    const lineItems = computeCoreWeddingLineItems({
      guestCount,
      venueTier: planData.venue_tier ?? "mid_range",
      venueType: planData.venue_type ?? "hotel",
      photographyTier: planData.photography_tier ?? "mid_range",
      attireTier: planData.attire_tier ?? "mid_range",
    });
    const computedCoreTotal = lineItems.reduce((s, li) => s + (li.subtotal || 0), 0);
    // The user's own ceiling wins as the plan total when they set one; the
    // computed core is always surfaced so the gap is visible.
    const totalBudget = Number(planData.total_budget) > 0 ? Number(planData.total_budget) : computedCoreTotal;
    const weddingDateISO = /^\d{4}-\d{2}$/.test(String(planData.wedding_date ?? ""))
      ? `${planData.wedding_date}-15`
      : planData.wedding_date;
    let paymentSchedule = [];
    try {
      paymentSchedule = weddingDateISO ? computePaymentSchedule(totalBudget, weddingDateISO) : [];
    } catch {
      paymentSchedule = [];
    }
    const now = new Date();
    const balanceDue = paymentSchedule.length ? new Date(paymentSchedule[paymentSchedule.length - 1].dueDate) : null;
    const monthsUntilBalance = balanceDue
      ? Math.max(1, (balanceDue.getFullYear() - now.getFullYear()) * 12 + (balanceDue.getMonth() - now.getMonth()))
      : null;
    const shortfall = Math.max(0, totalBudget - (Number(planData.current_savings) || 0));
    const requiredMonthly = monthsUntilBalance ? Math.ceil(shortfall / monthsUntilBalance) : null;
    const monthlyContribution = Number(planData.monthly_contribution) || 0;
    return {
      available: true,
      computedCoreTotal,
      totalBudget,
      perGuest: guestCount ? Math.round(totalBudget / guestCount) : null,
      lineItems,
      paymentSchedule,
      monthsUntilBalance,
      requiredMonthly,
      monthlyContribution,
      fundedOnPace: requiredMonthly != null ? monthlyContribution >= requiredMonthly : null,
      sources: ["confirmed wedding budget", "Singapore banquet/photography/attire rate tables", "Asset Profile ledger"],
      assumptions: [
        `${planData.venue_tier ?? "mid_range"} ${planData.venue_type ?? "hotel"} venue`,
        "30% deposit / 40% progress / 30% balance schedule",
      ],
    };
  },
  // months-to-fully-funded for a given monthly amount at this branch's real
  // total + current savings.
  projector(planData) {
    const guestCount = Number(planData.guest_count) || 0;
    const li = guestCount
      ? computeCoreWeddingLineItems({
          guestCount,
          venueTier: planData.venue_tier ?? "mid_range",
          venueType: planData.venue_type ?? "hotel",
          photographyTier: planData.photography_tier ?? "mid_range",
          attireTier: planData.attire_tier ?? "mid_range",
        })
      : [];
    const computedCoreTotal = li.reduce((s, x) => s + (x.subtotal || 0), 0);
    const total = Number(planData.total_budget) > 0 ? Number(planData.total_budget) : computedCoreTotal;
    const shortfall = Math.max(0, total - (Number(planData.current_savings) || 0));
    return (monthlyAmount) => {
      if (!(monthlyAmount > 0)) return null;
      if (shortfall <= 0) return 0;
      return Math.ceil(shortfall / monthlyAmount);
    };
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      max_delay_months: context.delayMonths ?? null,
      min_core_guests: Number(planData.guest_count) || null,
      no_balance_share: context.balanceShared === true,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
};

const ADAPTERS = { home: homeAdapter, wedding: weddingAdapter };

export function getFutureFieldAdapter(domain) {
  return ADAPTERS[domain] ?? null;
}

export function futureFieldSupportedDomains() {
  return Object.keys(ADAPTERS);
}
