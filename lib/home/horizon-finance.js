// Home Horizon - the Home Studio's domain finance engine (pure, no DB/AI).
//
// It does NOT tell the customer "you can borrow X". It answers: buy this
// home, in this month, at this price - and here is the life you have left.
//
// Every primitive is the SAME Singapore MAS/IRAS-grounded math the confirm
// route uses (lib/home-finance.js) - BSD brackets, ABSD, LTV tiers,
// TDSR/MSR caps, reducing-balance amortization. This module composes them
// into a Horizon-shaped result and attaches provenance to every figure.
// Reference-rule outputs are described as rules "as of <date>", never as a
// real-time approval.

import {
  calculateBsd,
  calculateAbsd,
  calculateDownPayment,
  calculateMonthlyInstallment,
  calculateMaxLoan,
  deriveLoanType,
} from "../home-finance.js";
import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

// MAS/IRAS rule vintage these caps reflect. Bumped only with a real rule change.
export const HOME_RULES_AS_OF = "2024-06";
export const HOME_RULES_REGION = "Singapore";

// Reference conveyancing costs - estimates, not quotes.
const LEGAL_FEE_RATE = 0.003; // ~0.3% of price
const LEGAL_FEE_CAP = 3000;
const VALUATION_FEE = 300;
const MORTGAGE_STAMP_RATE = 0.004; // 0.4% of loan
const MORTGAGE_STAMP_CAP = 500;

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function monthIndex(m) {
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return null;
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  return y * 12 + (mo - 1);
}
function nowIndex(now = new Date()) {
  return now.getUTCFullYear() * 12 + now.getUTCMonth();
}
function monthsFromNow(m, now = new Date()) {
  const i = monthIndex(m);
  return i == null ? null : i - nowIndex(now);
}

// A figure + how we know it. `unknown` is never coerced to 0 downstream.
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value), provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}

// The full Horizon for one candidate (price, month, price/tenure/rate).
// planData: {
//   estimated_price, property_type, monthly_income, monthly_expenses,
//   current_savings, monthly_contribution, target_complete_month,
//   down_payment_ratio?, loan_tenure?, rate_assumption?,
//   renovation_reserve?, keep_emergency_months?,
//   cpf_available? (only if confirmed), partner_contribution? (authorised only)
// }
// context: { committedMonthlyTotalExcludingHome, emergencyBufferMonths, now }
export function computeHomeHorizon({ planData, context = {} }) {
  const price = num(planData.estimated_price);
  if (!(price > 0)) return { available: false, reason: "no_price" };

  const propertyType = planData.property_type ?? "hdb_resale";
  const income = num(planData.monthly_income);
  const expenses = num(planData.monthly_expenses);
  const tenure = Math.max(5, Math.min(35, num(planData.loan_tenure, 25)));
  const rate = num(planData.rate_assumption, 3.5);
  const renovationReserve = num(planData.renovation_reserve, 0);
  const keepEmergencyMonths = num(planData.keep_emergency_months, 6);
  const currentSavings = num(planData.current_savings);
  const now = context.now ?? new Date();

  // CPF and partner money are UNKNOWN unless explicitly confirmed / authorised.
  const cpfKnown = planData.cpf_available != null;
  const cpfAvailable = cpfKnown ? Math.max(0, num(planData.cpf_available)) : 0;
  const partnerKnown = planData.partner_contribution != null;
  const partnerContribution = partnerKnown ? Math.max(0, num(planData.partner_contribution)) : 0;

  // ---- LTV / down payment (real MAS tiers) ----
  const loanType = deriveLoanType(propertyType);
  const dp = calculateDownPayment(price, { existingLoanCount: 0, loanType });
  const downPaymentRatio = planData.down_payment_ratio != null ? Math.max(0, Math.min(1, num(planData.down_payment_ratio))) : 1 - dp.ltv;
  const downPayment = Math.round(price * downPaymentRatio);
  const loanAmount = Math.max(0, price - downPayment);
  const minCashComponent = dp.minCashComponent;

  // ---- taxes + fees (real BSD, reference legal/valuation) ----
  const bsd = calculateBsd(price);
  const absd = calculateAbsd(price, { buyerType: "singapore_citizen", existingPropertyCount: 0 });
  const legalFee = Math.min(Math.round(price * LEGAL_FEE_RATE), LEGAL_FEE_CAP);
  const mortgageStamp = Math.min(Math.round(loanAmount * MORTGAGE_STAMP_RATE), MORTGAGE_STAMP_CAP);

  // ---- upfront stack ----
  const upfrontGross = downPayment + bsd + absd.amount + legalFee + VALUATION_FEE + mortgageStamp + renovationReserve;
  const upfrontCashRequired = Math.max(0, upfrontGross - cpfAvailable - partnerContribution);

  // ---- monthly repayment + interest stress range ----
  const monthlyRepayment = calculateMonthlyInstallment(loanAmount, rate, tenure);
  const repaymentLow = calculateMonthlyInstallment(loanAmount, Math.max(0.1, rate - 1), tenure);
  const repaymentHigh = calculateMonthlyInstallment(loanAmount, rate + 1.5, tenure); // asymmetric: rates rise faster than they fall

  // ---- regulatory ceiling (a RULE check, not an approval) ----
  const maxLoan = calculateMaxLoan({
    monthlyIncome: income,
    monthlyExpenses: expenses,
    propertyType,
    annualRatePercent: rate,
    tenureYears: tenure,
    existingMonthlyDebt: num(context.committedMonthlyTotalExcludingHome),
  });
  const withinRegulatory = loanAmount <= maxLoan.maxLoan && monthlyRepayment <= maxLoan.monthlyPaymentCeiling;

  // ---- ready month ----
  const monthlySurplus = Math.round(income - expenses - num(context.committedMonthlyTotalExcludingHome));
  const savingsPace = num(planData.monthly_contribution) > 0 ? num(planData.monthly_contribution) : Math.max(0, monthlySurplus);
  const shortfall = Math.max(0, upfrontCashRequired - currentSavings);
  const monthsToReady = savingsPace > 0 ? (shortfall <= 0 ? 0 : Math.ceil(shortfall / savingsPace)) : null;
  const readyMonth =
    monthsToReady == null
      ? null
      : new Date(now.getFullYear(), now.getMonth() + monthsToReady, 1).toISOString().slice(0, 7);
  const targetMonthsAway = monthsFromNow(planData.target_complete_month, now);
  const onPaceForTarget = targetMonthsAway != null && monthsToReady != null ? monthsToReady <= targetMonthsAway : null;

  // ---- the life you have left ----
  const cashAfterPurchase = currentSavings - upfrontCashRequired;
  const postPurchaseEmergencyMonths = expenses > 0 ? Math.round((cashAfterPurchase / expenses) * 10) / 10 : null;
  const monthlyBreathingRoom = Math.round(income - expenses - num(context.committedMonthlyTotalExcludingHome) - monthlyRepayment);

  // ---- sealable? explicit boolean ----
  const belowEmergencyFloor = postPurchaseEmergencyMonths != null && postPurchaseEmergencyMonths < keepEmergencyMonths;
  const sealable = Boolean(withinRegulatory) && monthlyBreathingRoom >= 0 && !belowEmergencyFloor && monthsToReady != null;
  const sealableReason = !withinRegulatory
    ? "exceeds_regulatory_ceiling"
    : monthlyBreathingRoom < 0
      ? "no_monthly_breathing_room"
      : belowEmergencyFloor
        ? "below_emergency_floor"
        : monthsToReady == null
          ? "no_savings_pace"
          : "ok";

  return {
    available: true,
    price: fig(price, planData.estimated_price != null ? "user_confirmed" : "system_estimate"),
    propertyType,
    purchaseMonth: planData.target_complete_month ?? null,
    upfrontStack: {
      downPayment: fig(downPayment, "system_estimate", { ratio: downPaymentRatio, ltv: dp.ltv }),
      buyerStampDuty: fig(bsd, "system_estimate", { basis: `IRAS BSD brackets as of ${HOME_RULES_AS_OF}` }),
      additionalBSD: fig(absd.amount, "system_estimate", { rate: absd.rate }),
      legalFees: fig(legalFee, "system_estimate", { basis: "~0.3% of price, capped, reference" }),
      valuationFee: fig(VALUATION_FEE, "system_estimate", { basis: "reference conveyancing cost" }),
      mortgageStamp: fig(mortgageStamp, "system_estimate", { basis: "0.4% of loan, capped, reference" }),
      renovationReserve: fig(renovationReserve, planData.renovation_reserve != null ? "user_confirmed" : "unknown"),
      cpfApplied: fig(cpfKnown ? cpfAvailable : null, cpfKnown ? "user_confirmed" : "unknown"),
      partnerApplied: fig(partnerKnown ? partnerContribution : null, partnerKnown ? "user_confirmed" : "unknown"),
      upfrontCashRequired: fig(upfrontCashRequired, "system_estimate"),
    },
    loan: {
      principal: fig(loanAmount, "system_estimate"),
      tenureYears: tenure,
      rateAssumption: { value: rate, provenance: "system_estimate", asOf: HOME_RULES_AS_OF, note: "assumption, not a locked rate" },
      monthlyRepayment: fig(monthlyRepayment, "system_estimate"),
      // Rate Weather: a range from the assumption moving, NOT a forecast.
      repaymentRange: { low: Math.round(repaymentLow), high: Math.round(repaymentHigh), note: "range from the rate assumption alone - not a prediction" },
      minCashComponent: fig(minCashComponent, "system_estimate", { basis: "5% of price for a bank loan" }),
    },
    regulatory: {
      withinCeiling: withinRegulatory,
      limitingFactor: maxLoan.limitingFactor,
      maxLoanUnderRules: fig(maxLoan.maxLoan, "system_estimate"),
      asOf: HOME_RULES_AS_OF,
      region: HOME_RULES_REGION,
      note: "TDSR/MSR/LTV rules check - a rule test, not a lender's approval",
    },
    readiness: {
      currentSavings: fig(planData.current_savings != null ? currentSavings : null, planData.current_savings != null ? "bank_confirmed" : "unknown"),
      monthlySavingsPace: fig(savingsPace, planData.monthly_contribution != null ? "user_confirmed" : "system_estimate"),
      shortfall: fig(shortfall, "system_estimate"),
      monthsToReady,
      readyMonth,
      targetMonth: planData.target_complete_month ?? null,
      onPaceForTarget,
    },
    afterlife: {
      cashAfterPurchase: fig(cashAfterPurchase, "system_estimate"),
      postPurchaseEmergencyMonths,
      keepEmergencyMonths,
      belowEmergencyFloor,
      monthlyBreathingRoom: fig(monthlyBreathingRoom, "system_estimate"),
    },
    sealable,
    sealableReason,
    assumptions: [
      { text: `Reducing-balance amortization at ${rate}% p.a. over ${tenure} years`, confidence: "high" },
      { text: `TDSR/MSR/LTV rules as of ${HOME_RULES_AS_OF} (${HOME_RULES_REGION})`, asOf: HOME_RULES_AS_OF },
      { text: "Legal / valuation / mortgage-stamp costs are reference estimates, not quotes", confidence: "medium" },
      cpfKnown ? null : { text: "CPF not confirmed - shown as unknown, not counted", confidence: "high" },
      partnerKnown ? null : { text: "Partner contribution not authorised - shown as unknown, not counted", confidence: "high" },
    ].filter(Boolean),
  };
}

// Safe Price Shadow: the largest price that, bought in `purchaseMonth`, keeps
// the customer above their emergency floor AND within regulatory rules,
// given their real savings pace. Binary search on price - real math, not a
// single "maximum".
export function safePriceForMonth({ purchaseMonth, planData, context = {} }) {
  const monthsAway = monthsFromNow(purchaseMonth, context.now ?? new Date());
  if (monthsAway == null || monthsAway < 0) return null;

  const base = { ...planData, target_complete_month: purchaseMonth };
  let lo = 50000;
  let hi = 5000000;
  let safe = null;
  for (let i = 0; i < 40 && hi - lo > 1000; i++) {
    const mid = Math.round((lo + hi) / 2);
    const h = computeHomeHorizon({ planData: { ...base, estimated_price: mid }, context });
    // "safe for that month" = sealable AND ready by then
    const readyByThen = h.available && h.readiness.monthsToReady != null && h.readiness.monthsToReady <= monthsAway;
    if (h.available && h.sealable && readyByThen) {
      safe = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return safe;
}
