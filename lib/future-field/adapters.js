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
import { computeFutureScore } from "../loan-finance.js";
import { projectMonthlyShift, monthsToPayoff as monthsToPayoffLoan } from "../living-plan/monthly-shift-projection.js";
import { computeTravelPlanFinance } from "../travel/plan-finance.js";
import { TRAVEL_RATE_PROVENANCE } from "../travel/rate-provenance.js";
import { computeInvestmentReadiness } from "../investment-readiness-finance.js";
import { computeProtectionEnvelope } from "../insurance/protection-finance.js";
import { computeFamilyConstellation } from "../family/constellation-finance.js";
import { computeHomeHorizon } from "../home/horizon-finance.js";
import { projectHomeImpact } from "../home/horizon-projector.js";

// home: the reality path is the confirmed plan; a branch moves price / date
// / monthly amount; feasibility is the same MAS/IRAS pipeline the confirm
// route uses.
const homeAdapter = {
  domain: "home",
  // planData shape: { estimated_price, property_type, monthly_income,
  //   monthly_expenses, down_payment_needed, current_savings }
  feasibility(planData, context = {}) {
    if (!(planData.estimated_price > 0)) return { available: false };
    const fin = computeHomeFinancials({
      price: planData.estimated_price,
      propertyType: planData.property_type ?? "hdb_resale",
      monthlyIncome: planData.monthly_income ?? 0,
      monthlyExpenses: planData.monthly_expenses ?? 0,
    });
    const downPaymentNeeded =
      planData.down_payment_needed ?? Math.round(planData.estimated_price * FIRST_HOME_DOWN_PAYMENT_RATE);
    // Home Horizon: the full domain finance (upfront stack, ready month,
    // post-purchase life). It owns the explicit sealability verdict now.
    const horizon = computeHomeHorizon({
      planData,
      context: {
        committedMonthlyTotalExcludingHome: context.committedExcludingWedding ?? context.committedMonthlyTotalExcludingHome ?? 0,
        emergencyBufferMonths: context.emergencyBufferMonths ?? null,
      },
    });
    return {
      available: true,
      ...fin,
      downPaymentNeeded,
      horizon: horizon.available ? horizon : null,
      // Part 0.4: explicit sealability verdict - the Horizon engine decides.
      sealable: horizon.available ? horizon.sealable : fin.within_affordability !== false,
      sealableReason: horizon.available ? horizon.sealableReason : fin.within_affordability === false ? "over_affordability_limit" : "within_affordability",
      sources: ["Asset Profile ledger", "MAS/IRAS BSD/ABSD/TDSR/MSR tables", "confirmed home plan"],
      assumptions: [`${fin.affordability_limiting_factor} limited`, "3.5% rate, 25y tenure"],
    };
  },
  // Server-owned cross-goal impactSet for a Home branch vs reality.
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    return projectHomeImpact({
      branchData,
      realityData,
      context: {
        committedMonthlyTotalExcludingHome: context.committedExcludingWedding ?? context.committedMonthlyTotalExcludingHome ?? 0,
        emergencyBufferMonths: context.emergencyBufferMonths ?? null,
        weddingActive: context.weddingActive ?? Boolean(context.home === null ? false : context.weddingActive),
        retirementActive: context.retirementActive ?? false,
      },
      allocation,
    });
  },
  allocationTargets() {
    return [
      { leg: "goal", goalId: "retirement", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
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
    const horizon =
      feasibility?.horizon ??
      computeHomeHorizon({
        planData,
        context: {
          committedMonthlyTotalExcludingHome: context.committedExcludingWedding ?? context.committedMonthlyTotalExcludingHome ?? 0,
          emergencyBufferMonths: context.emergencyBufferMonths ?? null,
        },
      });
    const pm = String(planData.target_complete_month ?? "").slice(0, 7);
    const purchaseYYYYMM = /^\d{4}-\d{2}$/.test(pm) ? Number(pm.replace("-", "")) : null;
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      max_delay_months: context.delayMonths ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
      // Home Horizon domain pins
      minimum_emergency_months: horizon?.available ? horizon.afterlife.postPurchaseEmergencyMonths : null,
      maximum_monthly_repayment: horizon?.available ? horizon.loan.monthlyRepayment.value : null,
      minimum_renovation_reserve: horizon?.available ? horizon.upfrontStack.renovationReserve.value : null,
      latest_purchase_month: purchaseYYYYMM,
      minimum_post_purchase_cash: horizon?.available ? horizon.afterlife.cashAfterPurchase.value : null,
      no_partner_share: Number(planData.partner_contribution || 0) > 0,
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

// emergency: the "reality" is the current buffer vs the safety floor; a
// branch changes the target coverage or the monthly rebuild amount; the
// projector answers "months until the buffer reaches the target".
const emergencyAdapter = {
  domain: "emergency",
  // planData: { monthly_expenses, current_savings, target_months (default 6),
  //   monthly_contribution (rebuild amount), floor_months (default 6) }
  feasibility(planData) {
    const expenses = Number(planData.monthly_expenses) || 0;
    if (!(expenses > 0)) return { available: false, reason: "no_expenses" };
    const targetMonths = Number(planData.target_months) || 6;
    const floorMonths = Number(planData.floor_months) || 6;
    const targetAmount = Math.round(expenses * targetMonths);
    const current = Number(planData.current_savings) || 0;
    const bufferMonths = Math.round((current / expenses) * 10) / 10;
    const shortfall = Math.max(0, targetAmount - current);
    return {
      available: true,
      monthlyExpenses: expenses,
      targetMonths,
      floorMonths,
      targetAmount,
      currentAmount: current,
      bufferMonths,
      shortfall,
      atOrAboveFloor: bufferMonths >= floorMonths,
      atOrAboveTarget: bufferMonths >= targetMonths,
      sealable: true, // a rebuild contribution is always sealable once expenses are known
      sealableReason: "rebuild_always_sealable",
      sources: ["Asset Profile ledger", "logged monthly expenses"],
      assumptions: [`${targetMonths}-month coverage target`, `${floorMonths}-month safety floor`],
    };
  },
  projector(planData) {
    const expenses = Number(planData.monthly_expenses) || 0;
    const targetMonths = Number(planData.target_months) || 6;
    const target = expenses * targetMonths;
    const shortfall = Math.max(0, target - (Number(planData.current_savings) || 0));
    return (monthlyAmount) => {
      if (!(monthlyAmount > 0)) return null;
      if (shortfall <= 0) return 0;
      return Math.ceil(shortfall / monthlyAmount);
    };
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? feasibility?.bufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
};

// loan: the reality is a confirmed loan (installment, rate, tenure). A
// branch changes the extra monthly repayment; feasibility = months to
// debt-free + total interest + a Future Score; the projector answers
// "months to debt-free at this total monthly payment". Paying more now
// costs monthly freedom (pressure); paying less frees cashflow.
const loanAdapter = {
  domain: "loan",
  // planData: { loan_amount, annual_rate_percent, tenure_years,
  //   monthly_installment, extra_repayment, monthly_income, monthly_expenses,
  //   current_savings, other_goals_monthly_outflow }
  feasibility(planData) {
    const principal = Number(planData.loan_amount) || 0;
    if (!(principal > 0)) return { available: false, reason: "no_loan" };
    const installment = Number(planData.monthly_installment) || 0;
    const extra = Number(planData.extra_repayment) || 0;
    const totalMonthly = installment + extra;
    const monthsLeft = monthsToPayoffLoan({ principal, annualRatePercent: planData.annual_rate_percent, monthlyPayment: totalMonthly });
    const baselineMonths = monthsToPayoffLoan({ principal, annualRatePercent: planData.annual_rate_percent, monthlyPayment: installment });
    const income = Number(planData.monthly_income) || 0;
    const fs = computeFutureScore({
      monthlyInstallment: totalMonthly,
      monthlyIncome: income,
      monthlyExpenses: Number(planData.monthly_expenses) || 0,
      currentSavings: Number(planData.current_savings) || 0,
      extraCashUsed: 0,
      otherGoalsMonthlyOutflow: Number(planData.other_goals_monthly_outflow) || 0,
    });
    return {
      available: true,
      principal,
      monthlyInstallment: installment,
      extraRepayment: extra,
      totalMonthlyPayment: totalMonthly,
      monthsToDebtFree: monthsLeft,
      baselineMonthsToDebtFree: baselineMonths,
      monthsSavedVsBaseline: baselineMonths != null && monthsLeft != null ? baselineMonths - monthsLeft : null,
      debtWeight: income > 0 ? Math.round((totalMonthly / income) * 100) / 100 : null, // repayment-to-income
      monthlyFreedom: income > 0 ? Math.round(income - (Number(planData.monthly_expenses) || 0) - totalMonthly) : null,
      futureScore: fs.future_score,
      emergencyMonthsAfter: fs.emergency_fund_months_covered_after,
      sealable: monthsLeft != null && (income <= 0 || income - (Number(planData.monthly_expenses) || 0) - totalMonthly >= 0),
      sealableReason:
        monthsLeft == null
          ? "payment_below_interest"
          : income > 0 && income - (Number(planData.monthly_expenses) || 0) - totalMonthly < 0
            ? "repayment_exceeds_free_cashflow"
            : "within_free_cashflow",
      sources: ["confirmed loan", "reducing-balance amortization"],
      assumptions: [`${planData.annual_rate_percent ?? "?"}% p.a.`, "extra repayment applied every month"],
    };
  },
  projector(planData) {
    const principal = Number(planData.loan_amount) || 0;
    const installment = Number(planData.monthly_installment) || 0;
    return (extraMonthly) =>
      monthsToPayoffLoan({ principal, annualRatePercent: planData.annual_rate_percent, monthlyPayment: installment + Math.max(0, Number(extraMonthly) || 0) });
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? feasibility?.emergencyMonthsAfter ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
  // A loan branch shifts the total monthly payment; paying less frees
  // cashflow (allocatable), paying more is pressure.
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    const monthlyBefore = (Number(realityData.monthly_installment) || 0) + (Number(realityData.extra_repayment) || 0);
    const monthlyAfter = (Number(branchData.monthly_installment) || 0) + (Number(branchData.extra_repayment) || 0);
    const rf = this.feasibility(realityData);
    const bf = this.feasibility(branchData);
    return projectMonthlyShift({
      domain: "loan",
      monthlyBefore,
      monthlyAfter,
      selfOutcome: { metric: "monthsToDebtFree", before: rf.monthsToDebtFree, after: bf.monthsToDebtFree, unit: "months" },
      context,
      allocation: allocation ?? branchData.allocation ?? null,
    });
  },
  allocationTargets() {
    return [
      { leg: "goal", goalId: "home", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
  },
};

// retirement: the reality is a confirmed retirement plan (monthly income
// gap vs CPF LIFE). A branch changes the monthly top-up contribution; the
// projector answers "months to close the gap" against a ~25-year
// retirement horizon of the gap.
const RETIREMENT_HORIZON_MONTHS = 25 * 12;
const retirementAdapter = {
  domain: "retirement",
  // planData: { target_monthly_income, gap_monthly, monthly_contribution,
  //   current_savings, monthly_income, monthly_expenses }
  feasibility(planData) {
    const gapMonthly = Number(planData.gap_monthly) || 0;
    const nestEggNeeded = Math.max(0, Math.round(gapMonthly * RETIREMENT_HORIZON_MONTHS));
    const contribution = Number(planData.monthly_contribution) || 0;
    const current = Number(planData.current_savings) || 0;
    const shortfall = Math.max(0, nestEggNeeded - current);
    const monthsToClose = contribution > 0 ? Math.ceil(shortfall / contribution) : null;
    const income = Number(planData.monthly_income) || 0;
    return {
      available: gapMonthly >= 0,
      targetMonthlyIncome: Number(planData.target_monthly_income) || null,
      gapMonthly,
      nestEggNeeded,
      monthlyContribution: contribution,
      shortfall,
      monthsToCloseGap: monthsToClose,
      yearsToCloseGap: monthsToClose != null ? Math.round((monthsToClose / 12) * 10) / 10 : null,
      contributionToIncome: income > 0 ? Math.round((contribution / income) * 100) / 100 : null,
      sealable: gapMonthly >= 0,
      sealableReason: gapMonthly >= 0 ? "gap_defined" : "gap_not_computed",
      sources: ["confirmed retirement plan", "CPF LIFE payout estimate", "logged income/expenses"],
      assumptions: [`${RETIREMENT_HORIZON_MONTHS / 12}-year retirement horizon for the income gap`, "contribution grows the gap fund linearly (no return assumed)"],
    };
  },
  projector(planData) {
    const gapMonthly = Number(planData.gap_monthly) || 0;
    const nestEggNeeded = Math.max(0, gapMonthly * RETIREMENT_HORIZON_MONTHS);
    const shortfall = Math.max(0, nestEggNeeded - (Number(planData.current_savings) || 0));
    return (monthly) => {
      if (!(monthly > 0)) return null;
      if (shortfall <= 0) return 0;
      return Math.ceil(shortfall / monthly);
    };
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    const rf = this.feasibility(realityData);
    const bf = this.feasibility(branchData);
    return projectMonthlyShift({
      domain: "retirement",
      monthlyBefore: Number(realityData.monthly_contribution) || 0,
      monthlyAfter: Number(branchData.monthly_contribution) || 0,
      selfOutcome: { metric: "yearsToCloseGap", before: rf.yearsToCloseGap, after: bf.yearsToCloseGap, unit: "years" },
      context,
      allocation: allocation ?? branchData.allocation ?? null,
    });
  },
  allocationTargets() {
    return [
      { leg: "goal", goalId: "home", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
  },
};

// travel: a life window. A branch changes travellers / nights / comfort /
// budget / monthly contribution; feasibility comes from reference rates
// (never a quote); a budget ceiling below the real cost is NOT sealable.
const travelAdapter = {
  domain: "travel",
  feasibility(planData) {
    const f = computeTravelPlanFinance({ planData });
    if (!f.available) return { available: false, reason: f.reason };
    return {
      available: true,
      computedCoreTotal: f.computedCoreTotal,
      userBudgetCeiling: f.userBudgetCeiling,
      totalBudget: f.planTotal,
      planTotal: f.planTotal,
      budgetGap: f.budgetGap,
      feasible: f.feasible,
      sealable: f.sealable,
      planStage: f.planStage,
      unresolvedItems: f.unresolvedItems,
      lineItems: f.lineItems,
      perTraveller: f.perTraveller,
      paymentSchedule: f.paymentSchedule,
      monthsUntilBalance: f.monthsUntilBalance,
      totalShortfall: f.totalShortfall,
      requiredMonthly: f.userRequiredMonthly,
      userRequiredMonthly: f.userRequiredMonthly,
      monthlyContribution: f.userMonthly,
      fundedOnPace: f.onPace,
      estimateProvenance: TRAVEL_RATE_PROVENANCE,
      sources: TRAVEL_RATE_PROVENANCE.map((p) => p.sourceName),
      assumptions: [`${planData.destination_type ?? "regional"} · ${planData.comfort_tier ?? "mid"} comfort (reference-rate estimate)`, "30% deposit / 70% balance schedule"],
    };
  },
  projector(planData) {
    const f = computeTravelPlanFinance({ planData });
    const shortfall = f.available ? f.totalShortfall : 0;
    return (monthly) => {
      if (!(monthly > 0)) return null;
      if (shortfall <= 0) return 0;
      return Math.ceil(shortfall / monthly);
    };
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    const rf = computeTravelPlanFinance({ planData: realityData });
    const bf = computeTravelPlanFinance({ planData: branchData });
    return projectMonthlyShift({
      domain: "travel",
      monthlyBefore: rf.available ? rf.userRequiredMonthly ?? rf.userMonthly : 0,
      monthlyAfter: bf.available ? bf.userRequiredMonthly ?? bf.userMonthly : 0,
      selfOutcome: { metric: "planBudget", before: rf.planTotal, after: bf.planTotal, unit: "sgd" },
      context,
      allocation: allocation ?? branchData.allocation ?? null,
    });
  },
  allocationTargets() {
    return [
      { leg: "goal", goalId: "home", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
  },
};

// investment: capital with a job. The reality is a confirmed recurring pick
// (monthly RSP). A branch changes the monthly commitment. feasibility uses
// the real readiness gate; the projector answers "months to reach a target
// pool" with NO return assumed (honest, not a growth promise).
const investmentAdapter = {
  domain: "investment",
  // planData: { monthly_commitment, horizon_years, target_pool,
  //   current_savings, monthly_expenses, credit_card_outstanding,
  //   available_monthly_cashflow, monthly_income }
  feasibility(planData) {
    const monthly = Number(planData.monthly_commitment) || 0;
    const readiness = computeInvestmentReadiness({
      currentSavings: Number(planData.current_savings) || 0,
      monthlyExpenses: Number(planData.monthly_expenses) || 0,
      creditCardOutstanding: Number(planData.credit_card_outstanding) || 0,
      availableMonthlyCashflow: Number(planData.available_monthly_cashflow) || 0,
    });
    const horizonYears = Number(planData.horizon_years) || 10;
    const targetPool = Number(planData.target_pool) || Math.round(monthly * horizonYears * 12);
    const contributedByHorizon = monthly * horizonYears * 12 + (Number(planData.current_savings) || 0);
    const monthsToTarget = monthly > 0 ? Math.ceil(Math.max(0, targetPool - (Number(planData.current_savings) || 0)) / monthly) : null;
    return {
      available: true,
      monthlyCommitment: monthly,
      horizonYears,
      targetPool,
      contributedByHorizon: Math.round(contributedByHorizon),
      monthsToTarget,
      yearsToTarget: monthsToTarget != null ? Math.round((monthsToTarget / 12) * 10) / 10 : null,
      readiness: readiness.readiness,
      emergencyFundMonths: readiness.emergencyFundMonths,
      hasEmergencyBuffer: readiness.hasEmergencyBuffer,
      sealable: readiness.readiness === "readyToInvest",
      sealableReason: readiness.readiness,
      sources: ["confirmed recurring investment", "investment readiness gate"],
      assumptions: ["No investment return assumed - this is the contributed amount only.", `${horizonYears}-year horizon`],
    };
  },
  projector(planData) {
    const horizonYears = Number(planData.horizon_years) || 10;
    const monthly0 = Number(planData.monthly_commitment) || 0;
    const targetPool = Number(planData.target_pool) || Math.round(monthly0 * horizonYears * 12);
    const shortfall = Math.max(0, targetPool - (Number(planData.current_savings) || 0));
    return (monthly) => {
      if (!(monthly > 0)) return null;
      if (shortfall <= 0) return 0;
      return Math.ceil(shortfall / monthly);
    };
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? feasibility?.emergencyFundMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    const rf = this.feasibility(realityData);
    const bf = this.feasibility(branchData);
    return projectMonthlyShift({
      domain: "investment",
      monthlyBefore: Number(realityData.monthly_commitment) || 0,
      monthlyAfter: Number(branchData.monthly_commitment) || 0,
      selfOutcome: { metric: "yearsToTarget", before: rf.yearsToTarget, after: bf.yearsToTarget, unit: "years" },
      context,
      allocation: allocation ?? branchData.allocation ?? null,
    });
  },
  allocationTargets() {
    return [
      { leg: "goal", goalId: "home", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
  },
};

// insurance: the Protection Envelope. The "monthly" here is the premium; a
// branch that adds cover costs premium (pressure), one that drops cover
// frees it. Unknowns are surfaced, never counted as gaps.
const insuranceAdapter = {
  domain: "insurance",
  feasibility(planData) {
    const e = computeProtectionEnvelope({ planData });
    return {
      available: true,
      nodes: e.nodes,
      quantifiedGap: e.quantifiedGap,
      unknownCount: e.unknownCount,
      partialCount: e.partialCount,
      knownGapCount: e.knownGapCount,
      monthlyPremiumNow: e.monthlyPremiumNow,
      premiumToCloseKnownGaps: e.premiumToCloseKnownGaps,
      envelopeStatus: e.envelopeStatus,
      sealable: e.sealable,
      planStage: e.envelopeStatus === "covered" ? "ready" : "exploring",
      sources: e.sources,
      assumptions: e.assumptions,
    };
  },
  projector(planData) {
    // months until the known gaps would be "covered" by paying the extra
    // premium - trivially immediate once premium is committed, so this
    // reports 0 when the extra premium >= what's needed, else null.
    const e = computeProtectionEnvelope({ planData });
    return (extraPremium) => (extraPremium >= e.premiumToCloseKnownGaps ? 0 : null);
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    return projectMonthlyShift({
      domain: "insurance",
      monthlyBefore: Number(realityData.monthly_premium_now) || 0,
      monthlyAfter: Number(branchData.monthly_premium_now) || 0,
      selfOutcome: {
        metric: "protectionGap",
        before: computeProtectionEnvelope({ planData: realityData }).quantifiedGap,
        after: computeProtectionEnvelope({ planData: branchData }).quantifiedGap,
        unit: "sgd",
      },
      context,
      allocation: allocation ?? branchData.allocation ?? null,
    });
  },
  allocationTargets() {
    return [
      { leg: "goal", goalId: "home", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
  },
};

// family: the Family Constellation. Shared future with boundaries. A branch
// changes the shared monthly contribution / split; Blind Merge governs
// what needs both partners. Individual balances never leave the finance
// module.
const familyAdapter = {
  domain: "family",
  feasibility(planData) {
    const f = computeFamilyConstellation({ planData });
    return {
      available: true,
      sharedMonthlyContribution: f.sharedMonthlyContribution,
      partnerAShare: f.partnerAShare,
      partnerBShare: f.partnerBShare,
      committedMonthly: f.committedMonthly,
      surplusMonthly: f.surplusMonthly,
      onPace: f.onPace,
      itemsByCategory: f.itemsByCategory,
      blindMerge: f.blindMerge,
      bothConfirmedRequired: f.bothConfirmedRequired,
      privacyNote: f.privacyNote,
      sealable: f.sealable,
      planStage: f.bothConfirmedRequired ? "needs_approval" : f.onPace ? "ready" : "exploring",
      sources: f.sources,
      assumptions: f.assumptions,
    };
  },
  projector(planData) {
    const f = computeFamilyConstellation({ planData });
    const shortfall = Math.max(0, f.committedMonthly - f.sharedMonthlyContribution);
    return (sharedMonthly) => {
      if (!(sharedMonthly > 0)) return null;
      if (shortfall <= 0) return 0;
      return Math.ceil(shortfall / sharedMonthly);
    };
  },
  constraintMetrics(planData, feasibility, context = {}) {
    return {
      emergency_floor_months: context.emergencyBufferMonths ?? null,
      max_monthly_contribution: context.proposedMonthly ?? null,
      no_balance_share: true, // family always keeps individual balances private
      no_guardian_auto_move: context.guardianAutoMove === true,
    };
  },
  projectImpacts(branchData, realityData, context = {}, allocation = null) {
    return projectMonthlyShift({
      domain: "family",
      monthlyBefore: Number(realityData.shared_monthly_contribution) || 0,
      monthlyAfter: Number(branchData.shared_monthly_contribution) || 0,
      selfOutcome: {
        metric: "sharedContribution",
        before: Number(realityData.shared_monthly_contribution) || 0,
        after: Number(branchData.shared_monthly_contribution) || 0,
        unit: "sgd_per_month",
      },
      context,
      allocation: allocation ?? branchData.allocation ?? null,
    });
  },
  allocationTargets() {
    return [
      { leg: "goal", goalId: "home", labelKey: "weddingLivingPlan.allocation.target.home" },
      { leg: "emergency", goalId: "emergency", labelKey: "weddingLivingPlan.allocation.target.emergency" },
      { leg: "flexible", goalId: "flexible", labelKey: "weddingLivingPlan.allocation.target.flexible" },
    ];
  },
};

const ADAPTERS = {
  home: homeAdapter,
  wedding: weddingAdapter,
  emergency: emergencyAdapter,
  loan: loanAdapter,
  retirement: retirementAdapter,
  travel: travelAdapter,
  investment: investmentAdapter,
  insurance: insuranceAdapter,
  family: familyAdapter,
};

export function getFutureFieldAdapter(domain) {
  return ADAPTERS[domain] ?? null;
}

export function futureFieldSupportedDomains() {
  return Object.keys(ADAPTERS);
}
