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
import { computeWeddingPlanFinance } from "../wedding/plan-finance.js";
import { projectWeddingBranchImpact } from "../wedding/cross-goal-projection.js";
import { WEDDING_RATE_PROVENANCE } from "../wedding/rate-provenance.js";

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
    const fin = computeWeddingPlanFinance({ planData });
    if (!fin.available) return { available: false, reason: fin.reason };
    const guestCount = Number(planData.guest_count) || 0;
    return {
      available: true,
      // financial semantics (lib/wedding/plan-finance.js)
      computedCoreTotal: fin.computedCoreTotal,
      userBudgetCeiling: fin.userBudgetCeiling,
      totalBudget: fin.planTotal, // kept for back-compat with existing callers
      planTotal: fin.planTotal,
      budgetGap: fin.budgetGap,
      feasible: fin.feasible,
      sealable: fin.sealable,
      planStage: fin.planStage,
      unresolvedItems: fin.unresolvedItems,
      perGuest: guestCount ? Math.round(fin.planTotal / guestCount) : null,
      lineItems: fin.lineItems,
      paymentSchedule: fin.paymentSchedule,
      monthsUntilBalance: fin.monthsUntilBalance,
      // partner-aware contribution split
      totalShortfall: fin.totalShortfall,
      partnerMonthly: fin.partnerMonthly,
      partnerCommittedTotal: fin.partnerCommittedTotal,
      userPersonalShortfall: fin.userPersonalShortfall,
      requiredMonthly: fin.userRequiredMonthly, // the USER's personal required monthly
      userRequiredMonthly: fin.userRequiredMonthly,
      combinedRequiredMonthly: fin.combinedRequiredMonthly,
      monthlyContribution: fin.userMonthly,
      fundedOnPace: fin.onPace,
      // provenance - Singapore reference-rate ESTIMATE, not a vendor quote
      estimateProvenance: WEDDING_RATE_PROVENANCE,
      sources: WEDDING_RATE_PROVENANCE.map((p) => p.sourceName),
      assumptions: [
        `${planData.venue_tier ?? "mid_range"} ${planData.venue_type ?? "hotel"} venue (reference-rate estimate)`,
        "30% deposit / 40% progress / 30% balance schedule",
        "Partner's earmarked savings stay private; only their committed monthly contribution is shared.",
      ],
    };
  },
  // Real cross-goal projection for one branch vs the reality path. Returns
  // two layers: availableImpact (what the freed cashflow COULD do) and
  // allocatedImpact (only what the customer actually allocated). Home and
  // Emergency nodes on the field move by the allocated layer, or stay put
  // when nothing is allocated.
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    const branchFinance = computeWeddingPlanFinance({ planData: branchData });
    const realityFinance = computeWeddingPlanFinance({ planData: realityData });
    if (!branchFinance.available || !realityFinance.available) return null;
    return projectWeddingBranchImpact({
      branchFinance,
      realityFinance,
      context,
      allocation: allocation ?? branchData.allocation ?? null,
    });
  },
  // The three legs a freed amount can be allocated to, for this domain.
  allocationTargets() {
    return [
      { leg: "goal", goalId: "home", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
  },
  // months-until the USER's personal share of the wedding is funded at a
  // given monthly amount - partner contribution is already netted out in
  // userPersonalShortfall.
  projector(planData) {
    const fin = computeWeddingPlanFinance({ planData });
    const shortfall = fin.available ? fin.userPersonalShortfall : 0;
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
