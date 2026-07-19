// Deterministic Singapore home-financing calculators. These are pure
// functions with no AI involvement — the wedding module taught us that
// letting a model compute totals/taxes produces inconsistent numbers, and
// here the numbers are real regulatory figures, not market estimates, so
// they must come from code, not from the model.
//
// Rates verified via MAS/IRAS as of 2026-07 (ABSD rates unchanged since
// 2023-04-27 per IRAS). Re-verify against https://www.iras.gov.sg before
// relying on this in a non-prototype context — these figures change with
// government policy.

const BSD_BRACKETS = [
  { upTo: 180_000, rate: 0.01 },
  { upTo: 360_000, rate: 0.02 },
  { upTo: 1_000_000, rate: 0.03 },
  { upTo: 1_500_000, rate: 0.04 },
  { upTo: 3_000_000, rate: 0.05 },
  { upTo: Infinity, rate: 0.06 },
];

export function calculateBsd(price) {
  let remaining = price;
  let previousCap = 0;
  let bsd = 0;
  for (const bracket of BSD_BRACKETS) {
    if (remaining <= 0) break;
    const bracketSize = bracket.upTo - previousCap;
    const taxable = Math.min(remaining, bracketSize);
    bsd += taxable * bracket.rate;
    remaining -= taxable;
    previousCap = bracket.upTo;
  }
  return Math.round(bsd);
}

const ABSD_RATES = {
  // buyerType: array indexed by (existingPropertyCount at time of purchase)
  singapore_citizen: [0, 0.2, 0.3],
  pr: [0.05, 0.3, 0.35],
  foreigner: [0.6, 0.6, 0.6],
  entity: [0.65, 0.65, 0.65],
};

export function calculateAbsd(price, { buyerType = "singapore_citizen", existingPropertyCount = 0 } = {}) {
  const rates = ABSD_RATES[buyerType] ?? ABSD_RATES.singapore_citizen;
  const rate = rates[Math.min(existingPropertyCount, rates.length - 1)];
  return { rate, amount: Math.round(price * rate) };
}

// Standard reducing-balance mortgage payment for a given principal.
export function calculateMonthlyInstallment(loanAmount, annualRatePercent, tenureYears) {
  const monthlyRate = annualRatePercent / 100 / 12;
  const numPayments = tenureYears * 12;
  if (monthlyRate === 0) return Math.round(loanAmount / numPayments);
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return Math.round((loanAmount * monthlyRate * factor) / (factor - 1));
}

// Inverse of the above: given a monthly payment ceiling, what's the largest
// loan that fits it at this rate/tenure. Exported so lib/loan-finance.js's
// purpose-agnostic archetype engine can reuse the same amortization math
// instead of duplicating it.
export function calculateLoanForTargetPayment(monthlyPayment, annualRatePercent, tenureYears) {
  const monthlyRate = annualRatePercent / 100 / 12;
  const numPayments = tenureYears * 12;
  if (monthlyRate === 0) return monthlyPayment * numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (monthlyPayment * (factor - 1)) / (monthlyRate * factor);
}

const MSR_CAP = 0.3; // HDB/EC loans bought new from a developer only
const TDSR_CAP = 0.55; // all property loans

// propertyType: "hdb_new" | "ec_new" | anything else (resale HDB, condo,
// landed) — MSR only applies to new HDB/EC bought directly from HDB/developer.
export function calculateMaxLoan({
  monthlyIncome,
  monthlyExpenses,
  propertyType,
  annualRatePercent,
  tenureYears,
  existingMonthlyDebt = 0,
}) {
  const tdsrCeiling = monthlyIncome * TDSR_CAP - existingMonthlyDebt;
  const msrApplies = propertyType === "hdb_new" || propertyType === "ec_new";
  const msrCeiling = msrApplies ? monthlyIncome * MSR_CAP - existingMonthlyDebt : Infinity;
  const monthlyPaymentCeiling = Math.max(0, Math.min(tdsrCeiling, msrCeiling));
  const maxLoan = calculateLoanForTargetPayment(monthlyPaymentCeiling, annualRatePercent, tenureYears);
  return {
    monthlyPaymentCeiling: Math.round(monthlyPaymentCeiling),
    maxLoan: Math.round(maxLoan),
    limitingFactor: msrApplies && msrCeiling <= tdsrCeiling ? "MSR" : "TDSR",
    // Not modeled: available monthly income after monthlyExpenses is a
    // separate affordability signal from the regulatory TDSR/MSR caps —
    // surfaced to the caller so it can flag "regulatory max exceeds what the
    // household can actually spare" without conflating the two.
    residualIncomeAfterExpenses: Math.round(monthlyIncome - monthlyExpenses),
  };
}

const LTV_TIERS = [0.75, 0.45, 0.35]; // 1st / 2nd / 3rd+ housing loan, no age-tenure reduction modeled

// loanType: "hdb" | "bank" — both currently capped at the same LTV tiers.
// HDB concessionary loan: 20% down payment, fully payable by CPF/cash, no
// mandatory cash component. Bank loan: min 5% of price must be cash, the
// rest can be CPF/cash.
export function calculateDownPayment(price, { existingLoanCount = 0, loanType = "bank" } = {}) {
  const ltv = LTV_TIERS[Math.min(existingLoanCount, LTV_TIERS.length - 1)];
  const loanAmount = Math.round(price * ltv);
  const totalDownPayment = price - loanAmount;
  return {
    ltv,
    loanAmount,
    totalDownPayment,
    minCashComponent: loanType === "hdb" ? 0 : Math.round(price * 0.05),
  };
}

// Only new/resale HDB flats bought directly are eligible for an HDB
// concessionary loan — EC/condo/landed always use a bank loan. Exported so
// lib/loan-finance.js's home-purpose archetype path can reuse the same
// derivation instead of duplicating the ternary.
export function deriveLoanType(propertyType) {
  return propertyType === "hdb_new" || propertyType === "hdb_resale" ? "hdb" : "bank";
}

// Runs the full deterministic pipeline for one candidate property price,
// combining all of the above into the numbers a plan needs. AI-supplied
// price is the only untrusted input; everything else here is code.
export function computeHomeFinancials({
  price,
  propertyType,
  monthlyIncome,
  monthlyExpenses,
  buyerType = "singapore_citizen",
  existingPropertyCount = 0,
  annualRatePercent = 3.5,
  tenureYears = 25,
}) {
  const bsd = calculateBsd(price);
  const absd = calculateAbsd(price, { buyerType, existingPropertyCount });
  const loanType = deriveLoanType(propertyType);
  const downPayment = calculateDownPayment(price, { existingLoanCount: existingPropertyCount, loanType });
  const installment = calculateMonthlyInstallment(downPayment.loanAmount, annualRatePercent, tenureYears);
  const affordability = calculateMaxLoan({
    monthlyIncome,
    monthlyExpenses,
    propertyType,
    annualRatePercent,
    tenureYears,
  });
  return {
    price,
    bsd,
    absd_rate: absd.rate,
    absd_amount: absd.amount,
    loan_amount: downPayment.loanAmount,
    down_payment_cash_cpf: downPayment.totalDownPayment,
    min_cash_component: downPayment.minCashComponent,
    monthly_installment: installment,
    affordability_ceiling_monthly: affordability.monthlyPaymentCeiling,
    affordability_limiting_factor: affordability.limitingFactor,
    within_affordability: installment <= affordability.monthlyPaymentCeiling,
    stamp_duty_total: bsd + absd.amount,
  };
}
