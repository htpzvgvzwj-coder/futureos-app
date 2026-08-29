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

const ADAPTERS = { home: homeAdapter };

export function getFutureFieldAdapter(domain) {
  return ADAPTERS[domain] ?? null;
}

export function futureFieldSupportedDomains() {
  return Object.keys(ADAPTERS);
}
