// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// The real "zero input" draft for Home Planner's entry screen: instead of
// a blank "tell us about the home you want" box, this answers the two
// things the bank already has enough real data to answer BEFORE asking
// the customer anything - a real safe budget range, and a real down-
// payment readiness projection. Reuses lib/home-finance.js's real
// Singapore MAS/IRAS-grounded calculateMaxLoan/calculateDownPayment
// (already used by the confirm-time calculation, not a second formula),
// and the same real committed-monthly-total (already-confirmed loans/
// investments/other savings) every cross-goal check in this app reads.

import { calculateMaxLoan, calculateDownPayment } from "./home-finance.js";

const FIRST_HOME_DOWN_PAYMENT_RATE = 1 - calculateDownPayment(100, { existingLoanCount: 0, loanType: "bank" }).ltv; // 0.25, derived not hardcoded twice

// Two real scenarios bracketing the honest range a customer would actually
// see once they pick a property type - HDB (MSR applies, more
// conservative) and private/resale (TDSR only, higher ceiling). Both use
// the exact same real calculateMaxLoan the confirm-time calculation uses,
// just with a placeholder propertyType/rate since no specific property is
// chosen yet.
export function computeHomeBudgetRange({ monthlyIncome, monthlyExpenses, committedMonthlyTotal }) {
  if (!(monthlyIncome > 0)) return null;

  const hdb = calculateMaxLoan({
    monthlyIncome,
    monthlyExpenses,
    propertyType: "hdb_new",
    annualRatePercent: 2.6,
    tenureYears: 25,
    existingMonthlyDebt: committedMonthlyTotal,
  });
  const privateProperty = calculateMaxLoan({
    monthlyIncome,
    monthlyExpenses,
    propertyType: "private",
    annualRatePercent: 3.5,
    tenureYears: 25,
    existingMonthlyDebt: committedMonthlyTotal,
  });

  const ltv = calculateDownPayment(100, { existingLoanCount: 0, loanType: "bank" }).ltv;
  const hdbMaxPrice = Math.round(hdb.maxLoan / ltv);
  const privateMaxPrice = Math.round(privateProperty.maxLoan / ltv);

  return {
    lowPrice: Math.min(hdbMaxPrice, privateMaxPrice),
    highPrice: Math.max(hdbMaxPrice, privateMaxPrice),
    hdbMaxPrice,
    privateMaxPrice,
    hdbLimitingFactor: hdb.limitingFactor,
    privateLimitingFactor: privateProperty.limitingFactor,
  };
}

// Real down-payment readiness, same real projection technique Time
// Machine (lib/future-comparison-finance.js) already uses: real current
// savings, real monthly surplus after every already-confirmed commitment,
// walked forward to a real ready date - never a guess at "you're close".
export function computeDownPaymentReadiness({ targetPrice, currentSavings, monthlyIncome, monthlyExpenses, committedMonthlyTotal }) {
  const downPaymentNeeded = Math.round(targetPrice * FIRST_HOME_DOWN_PAYMENT_RATE);
  const monthlySurplus = Math.round(monthlyIncome - monthlyExpenses - committedMonthlyTotal);
  const shortfall = downPaymentNeeded - currentSavings;

  if (shortfall <= 0) {
    return { downPaymentNeeded, monthlySurplus, monthsToReady: 0, readyNow: true };
  }
  if (monthlySurplus <= 0) {
    return { downPaymentNeeded, monthlySurplus, monthsToReady: null, readyNow: false };
  }

  const monthsToReady = Math.ceil(shortfall / monthlySurplus);
  const readyDate = new Date();
  readyDate.setMonth(readyDate.getMonth() + monthsToReady);

  return {
    downPaymentNeeded,
    monthlySurplus,
    monthsToReady,
    readyNow: false,
    readyMonth: readyDate.toISOString().slice(0, 7),
  };
}
