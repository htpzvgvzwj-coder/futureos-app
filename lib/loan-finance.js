// Deterministic, purpose-aware loan-strategy engine. Mirrors the discipline
// established by lib/home-finance.js and lib/wedding-finance.js: the AI only
// supplies a categorical choice (purpose, archetype, modifiers) plus, for
// unsecured purposes, the loan amount the customer stated they need — every
// dollar figure here (loan amount clamp, monthly installment, total
// interest, Future Score) is computed by code, never invented by a model.
//
// Rates below are illustrative Singapore-market approximations for
// renovation/personal installment loans and mortgage/no-lock-in premiums —
// re-verify before relying on this in a non-prototype context, same
// disclaimer as every other *-finance.js module in this codebase.

import { calculateMonthlyInstallment, calculateLoanForTargetPayment, calculateDownPayment, deriveLoanType } from "./home-finance.js";

const TDSR_CAP = 0.55; // generic SG consumer-credit serviceability cap, reused across purposes
const MSR_CAP = 0.3; // home purpose only, new HDB/EC bought directly

export const LOAN_PURPOSES = {
  home: {
    key: "home",
    usesCollateral: true,
    baseRatePercent: 3.0,
    archetypes: {
      safe: { targetCeilingFraction: 0.45, tenureYearsHdb: 25, tenureYearsBank: 30 },
      balanced: { targetCeilingFraction: 0.68, tenureYearsHdb: 25, tenureYearsBank: 25 },
      fast: { targetCeilingFraction: 0.92, tenureYearsHdb: 20, tenureYearsBank: 20 },
    },
  },
  renovation: {
    key: "renovation",
    usesCollateral: false,
    baseRatePercent: 5.5,
    archetypeTenureYears: { safe: 5, balanced: 4, fast: 2 },
  },
  personal: {
    key: "personal",
    usesCollateral: false,
    baseRatePercent: 7.0,
    archetypeTenureYears: { safe: 5, balanced: 3, fast: 1 },
  },
};

export const LOAN_ARCHETYPE_KEYS = ["safe", "balanced", "fast"];
export const LOAN_MODIFIER_KEYS = ["flexible", "growth", "protection"];

// Real "teeth" for the dual-gated Relationship Ledger tier (see getRelationshipBenefits in
// page.jsx): a shaved-off percentage-point discount applied to the ACTUAL rate used to compute the
// customer's real monthly installment - not just an advertised card, same as RoboInvest's fee tier
// gets real teeth. Illustrative percentage points, same disclaimer as every rate in this module.
export const RELATIONSHIP_RATE_DISCOUNT_PERCENT = { 0: 0, 1: 0.1, 2: 0.2, 3: 0.35 };

// Generic serviceability ceiling — TDSR always, plus MSR for new-build
// HDB/EC home purchases. Distinct from home-finance.js's calculateMaxLoan,
// which is keyed off propertyType/tenure in a home-only shape; this version
// is purpose-agnostic so renovation/personal loans can reuse it too (with
// msrApplies always false for them).
function calculateServiceabilityCeiling({ monthlyIncome, existingMonthlyDebt = 0, msrApplies = false }) {
  const tdsrCeiling = monthlyIncome * TDSR_CAP - existingMonthlyDebt;
  const msrCeiling = msrApplies ? monthlyIncome * MSR_CAP - existingMonthlyDebt : Infinity;
  return Math.max(0, Math.min(tdsrCeiling, msrCeiling));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function emergencyFundImpactLabel(monthsCovered) {
  if (monthsCovered >= 6) return "protected";
  if (monthsCovered >= 3) return "healthy";
  if (monthsCovered >= 1) return "reduced";
  return "weak";
}

function otherGoalsImpactLabel(residualIncome, monthlyIncome) {
  if (residualIncome >= monthlyIncome * 0.1) return "on_track";
  if (residualIncome >= 0) return "tight";
  return "at_risk";
}

// Shared Future Score formula — three independently-inspectable, weighted
// components, same "no unexplained numbers" discipline as the rest of this
// codebase. extraCashUsed is 0 for fixed-principal (unsecured) purposes,
// since there's no down payment to draw savings down for. Exported (in
// addition to being used internally below) so Strategic Balance's "try
// adjusting" simulation (lib/strategic-balance-finance.js) can recompute
// just the score component affected by a hypothetical cashflow change,
// without re-deriving loan amount/tenure/rate, which are structural and
// wouldn't actually change.
export function computeFutureScore({ monthlyInstallment, monthlyIncome, monthlyExpenses, currentSavings, extraCashUsed, otherGoalsMonthlyOutflow }) {
  const repaymentToIncomeRatio = monthlyIncome > 0 ? monthlyInstallment / monthlyIncome : 1;
  const stressScore = clamp(100 - repaymentToIncomeRatio * 200, 0, 100);

  const postPurchaseSavings = Math.max(0, currentSavings - extraCashUsed);
  const emergencyFundMonthsCoveredAfter = monthlyExpenses > 0 ? postPurchaseSavings / monthlyExpenses : 0;
  const bufferScore = clamp((emergencyFundMonthsCoveredAfter / 6) * 100, 0, 100);

  const residualIncome = monthlyIncome - monthlyExpenses - otherGoalsMonthlyOutflow - monthlyInstallment;
  const residualScore = clamp((residualIncome / (monthlyIncome * 0.2)) * 100, 0, 100);

  const futureScore = Math.round(stressScore * 0.4 + bufferScore * 0.3 + residualScore * 0.3);

  return {
    future_score: futureScore,
    emergency_fund_months_covered_after: Math.round(emergencyFundMonthsCoveredAfter * 10) / 10,
    emergency_fund_impact: emergencyFundImpactLabel(emergencyFundMonthsCoveredAfter),
    residual_income_monthly: Math.round(residualIncome),
    other_goals_impact: otherGoalsImpactLabel(residualIncome, monthlyIncome),
  };
}

// Computes one archetype (safe/balanced/fast) for one purpose. Returns a
// common snake_case shape regardless of purpose/branch so downstream
// validation/frontend code never needs purpose-specific field handling.
// `principalBasis` means different things per branch, by design: for
// collateral purposes (home) it's the property PRICE, from which loan
// amount and down payment are both derived; for fixed-principal purposes
// (renovation/personal) it's the loan AMOUNT the customer said they need.
export function computeLoanArchetype(purposeKey, archetypeKey, params) {
  const purpose = LOAN_PURPOSES[purposeKey];
  const {
    principalBasis,
    propertyType,
    monthlyIncome,
    monthlyExpenses,
    existingMonthlyDebt = 0,
    currentSavings,
    otherGoalsMonthlyOutflow,
    relationshipTier = 0,
  } = params;
  const relationshipDiscountPercent = RELATIONSHIP_RATE_DISCOUNT_PERCENT[relationshipTier] ?? 0;
  const annualRatePercent = Math.max(purpose.baseRatePercent - relationshipDiscountPercent, 0.5);

  let tenureYears, loanAmount, downPaymentCashCpf, minCashComponent, ltvCapped, exceedsServiceability, extraCashUsed;

  if (purpose.usesCollateral) {
    const archetype = purpose.archetypes[archetypeKey];
    const loanType = deriveLoanType(propertyType);
    tenureYears = loanType === "hdb" ? archetype.tenureYearsHdb : archetype.tenureYearsBank;
    const msrApplies = propertyType === "hdb_new" || propertyType === "ec_new";
    const ceiling = calculateServiceabilityCeiling({ monthlyIncome, existingMonthlyDebt, msrApplies });
    const targetMonthlyPayment = ceiling * archetype.targetCeilingFraction;
    const targetLoanAmount = calculateLoanForTargetPayment(targetMonthlyPayment, annualRatePercent, tenureYears);
    const ltv = calculateDownPayment(principalBasis, { existingLoanCount: 0, loanType });
    loanAmount = Math.min(targetLoanAmount, ltv.loanAmount);
    ltvCapped = targetLoanAmount > ltv.loanAmount;
    exceedsServiceability = false;
    downPaymentCashCpf = principalBasis - loanAmount;
    minCashComponent = ltv.minCashComponent;
    // How much MORE than the regulatory LTV-minimum down payment this
    // archetype puts down — the amount that could be redirected into
    // investing instead (the `growth` modifier's lever).
    extraCashUsed = Math.max(0, ltv.loanAmount - loanAmount);
  } else {
    tenureYears = purpose.archetypeTenureYears[archetypeKey];
    const ceiling = calculateServiceabilityCeiling({ monthlyIncome, existingMonthlyDebt, msrApplies: false });
    const maxServiceableLoan = calculateLoanForTargetPayment(ceiling, annualRatePercent, tenureYears);
    loanAmount = Math.min(principalBasis, maxServiceableLoan);
    exceedsServiceability = principalBasis > maxServiceableLoan;
    ltvCapped = false;
    downPaymentCashCpf = 0;
    minCashComponent = 0;
    extraCashUsed = 0; // no down payment concept for unsecured loans
  }

  const monthlyInstallment = calculateMonthlyInstallment(loanAmount, annualRatePercent, tenureYears);
  const totalInterest = Math.round(monthlyInstallment * tenureYears * 12 - loanAmount);

  const score = computeFutureScore({
    monthlyInstallment,
    monthlyIncome,
    monthlyExpenses,
    currentSavings,
    extraCashUsed,
    otherGoalsMonthlyOutflow,
  });

  return {
    purpose: purposeKey,
    archetype: archetypeKey,
    principal_basis: principalBasis,
    property_type: propertyType ?? null,
    loan_amount: Math.round(loanAmount),
    down_payment_cash_cpf: Math.round(downPaymentCashCpf),
    min_cash_component: Math.round(minCashComponent),
    extra_cash_used: Math.round(extraCashUsed),
    tenure_years: tenureYears,
    annual_rate_percent: annualRatePercent,
    relationship_tier: relationshipTier,
    relationship_discount_percent: relationshipDiscountPercent,
    monthly_installment: monthlyInstallment,
    total_interest: totalInterest,
    ltv_capped: ltvCapped,
    exceeds_serviceability: exceedsServiceability,
    modifiers_applied: [],
    insurance_premium_monthly: null,
    invested_lump_sum: null,
    projected_investment_value: null,
    ...score,
  };
}

export function computeAllLoanArchetypes(purposeKey, params) {
  return LOAN_ARCHETYPE_KEYS.reduce((acc, archetypeKey) => {
    acc[archetypeKey] = computeLoanArchetype(purposeKey, archetypeKey, params);
    return acc;
  }, {});
}

// Applies flexible/growth/protection in a fixed order so combinations are
// deterministic, then recomputes the score ONCE from the final effective
// numbers (not incrementally per modifier) to avoid order-dependent drift.
export function applyLoanModifiers(archetypeResult, modifierKeys, context) {
  let { loan_amount: loanAmount, down_payment_cash_cpf: downPaymentCashCpf, tenure_years: tenureYears, extra_cash_used: extraCashUsed } = archetypeResult;
  let annualRatePercent = archetypeResult.annual_rate_percent;
  let insurancePremiumMonthly = null;
  let investedLumpSum = null;
  let projectedInvestmentValue = null;

  if (modifierKeys.includes("flexible")) {
    annualRatePercent += 0.15;
  }

  if (modifierKeys.includes("growth")) {
    // Diverts half of whatever this archetype already put down beyond the
    // LTV minimum (computed once in computeLoanArchetype as
    // extra_cash_used) into the loan principal instead, freeing that cash
    // for a lump-sum investment. Naturally a no-op (extraCashUsed === 0)
    // for fixed-principal purposes, which have no down-payment buffer at
    // all — invested_lump_sum stays null rather than a fabricated number.
    const divertible = extraCashUsed * 0.5;
    if (divertible > 0) {
      loanAmount += divertible;
      downPaymentCashCpf -= divertible;
      extraCashUsed -= divertible;
      investedLumpSum = Math.round(divertible);
      projectedInvestmentValue = Math.round(divertible * Math.pow(1.03, tenureYears));
    }
  }

  const monthlyInstallment = calculateMonthlyInstallment(loanAmount, annualRatePercent, tenureYears);
  const totalInterest = Math.round(monthlyInstallment * tenureYears * 12 - loanAmount);

  let effectiveMonthlyOutflowExtra = 0;
  if (modifierKeys.includes("protection")) {
    insurancePremiumMonthly = Math.round(loanAmount * 0.0004);
    effectiveMonthlyOutflowExtra = insurancePremiumMonthly;
  }

  const score = computeFutureScore({
    monthlyInstallment: monthlyInstallment + effectiveMonthlyOutflowExtra,
    monthlyIncome: context.monthlyIncome,
    monthlyExpenses: context.monthlyExpenses,
    currentSavings: context.currentSavings,
    extraCashUsed,
    otherGoalsMonthlyOutflow: context.otherGoalsMonthlyOutflow,
  });

  return {
    ...archetypeResult,
    loan_amount: Math.round(loanAmount),
    down_payment_cash_cpf: Math.round(downPaymentCashCpf),
    extra_cash_used: Math.round(extraCashUsed),
    annual_rate_percent: annualRatePercent,
    monthly_installment: monthlyInstallment,
    total_interest: totalInterest,
    modifiers_applied: modifierKeys,
    insurance_premium_monthly: insurancePremiumMonthly,
    invested_lump_sum: investedLumpSum,
    projected_investment_value: projectedInvestmentValue,
    ...score,
  };
}
