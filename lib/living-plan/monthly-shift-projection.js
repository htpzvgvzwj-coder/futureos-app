// Living Plan - generic "a branch changed a monthly commitment" projection
// (pure, no DB/AI).
//
// Same two-layer model as the Wedding projection, generalised so Loan,
// Retirement, and other domains reuse it:
//   - a branch that pays LESS per month FREES cashflow -> availableImpact
//     (what it could do) + allocatedImpact (only what the customer set)
//   - a branch that pays MORE returns `pressure` (extra monthly needed)
//   - no change -> `neutral`
//
// Nothing is routed anywhere automatically.

import { computeReadyDateForMonthlyAmount } from "../home-draft-finance.js";
import { normalizeAllocation, allocationSum } from "./allocation.js";

const BUFFER_HORIZON_MONTHS = 12;

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function readyMonth(months, now) {
  if (months == null) return null;
  const d = new Date(now);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 7);
}
function bufferGain(monthlyToEmergency, monthlyExpenses) {
  if (!(monthlyExpenses > 0) || !(monthlyToEmergency > 0)) return 0;
  return Math.round(((monthlyToEmergency * BUFFER_HORIZON_MONTHS) / monthlyExpenses) * 10) / 10;
}

// monthlyBefore / monthlyAfter: the domain's own monthly commitment on the
// reality path vs the branch.
// context: { monthlyIncome, monthlyExpenses, committedExcludingDomain,
//   emergencyBufferMonths, home: { monthlyContribution, downPaymentNeeded,
//   currentSavings } | null }
// selfOutcome: { metric, before, after, unit } - the domain's own headline
//   outcome (e.g. "debt-free month" / "gap-closed month"), attached raw.
// allocation: { goalMonthly, emergencyMonthly, flexibleMonthly } | null
export function projectMonthlyShift({ domain, monthlyBefore, monthlyAfter, selfOutcome = null, context = {}, allocation = null, now = new Date() }) {
  const mb = num(monthlyBefore);
  const ma = num(monthlyAfter);
  const freed = mb - ma; // + = branch pays less -> frees money

  const income = num(context.monthlyIncome);
  const expenses = num(context.monthlyExpenses);
  const committedOther = num(context.committedExcludingDomain);
  const cashflowBefore = income > 0 ? income - expenses - committedOther - mb : null;
  const cashflowBaseline = income > 0 ? income - expenses - committedOther - ma : null;

  const self = { domain, metric: selfOutcome?.metric ?? "monthlyContribution", before: selfOutcome?.before ?? mb, after: selfOutcome?.after ?? ma, unit: selfOutcome?.unit ?? "sgd_per_month", delta: (selfOutcome?.after ?? ma) - (selfOutcome?.before ?? mb) };
  const base = {
    self,
    freedCashflow: Math.round(freed),
    cashflow: { before: cashflowBefore, baseline: cashflowBaseline },
    home: null,
    emergency: { bufferBefore: num(context.emergencyBufferMonths), bufferAfter: num(context.emergencyBufferMonths), floorMonths: 6, direction: "flat" },
    availableImpact: null,
    allocatedImpact: null,
    confidence: income > 0 ? "high" : "low",
    assumptions: [
      "Freed cashflow is NOT moved anywhere until you allocate it.",
      "Emergency buffer effects are projected over 12 months.",
    ],
  };

  if (Math.round(freed) === 0) return { ...base, mode: "neutral" };
  if (freed < 0) return { ...base, mode: "pressure", pressure: { extraMonthlyNeeded: Math.round(-freed) } };

  // freed > 0 -----------------------------------------------------------
  const bufferBefore = num(context.emergencyBufferMonths);
  let maxHome = null;
  if (context.home && num(context.home.downPaymentNeeded) > 0) {
    const hm = num(context.home.monthlyContribution);
    const before = computeReadyDateForMonthlyAmount({ downPaymentNeeded: context.home.downPaymentNeeded, currentSavings: num(context.home.currentSavings), monthlyAmount: hm });
    const after = computeReadyDateForMonthlyAmount({ downPaymentNeeded: context.home.downPaymentNeeded, currentSavings: num(context.home.currentSavings), monthlyAmount: hm + freed });
    maxHome = {
      readyMonthNow: readyMonth(before.monthsToReady, now),
      maxReadyMonth: readyMonth(after.monthsToReady, now),
      maxMonthsEarlier: before.monthsToReady != null && after.monthsToReady != null ? Math.max(0, before.monthsToReady - after.monthsToReady) : null,
    };
  }
  const availableImpact = {
    freedCashflow: Math.round(freed),
    unallocated: Math.round(freed - allocationSum(allocation)),
    maxHomeMonthsEarlier: maxHome?.maxMonthsEarlier ?? null,
    maxHomeReadyMonth: maxHome?.maxReadyMonth ?? null,
    homeReadyMonthNow: maxHome?.readyMonthNow ?? null,
    maxEmergencyBufferAfter: expenses > 0 ? Math.round((bufferBefore + bufferGain(freed, expenses)) * 10) / 10 : bufferBefore,
    maxCashflowAfter: cashflowBaseline,
    note: "possible_not_committed",
  };

  let allocatedImpact = null;
  const a = normalizeAllocation(allocation);
  if (allocationSum(a) > 0) {
    let home = null;
    if (context.home && num(context.home.downPaymentNeeded) > 0) {
      const hm = num(context.home.monthlyContribution);
      const before = computeReadyDateForMonthlyAmount({ downPaymentNeeded: context.home.downPaymentNeeded, currentSavings: num(context.home.currentSavings), monthlyAmount: hm });
      const after = computeReadyDateForMonthlyAmount({ downPaymentNeeded: context.home.downPaymentNeeded, currentSavings: num(context.home.currentSavings), monthlyAmount: hm + a.goalMonthly });
      const md = before.monthsToReady != null && after.monthsToReady != null ? after.monthsToReady - before.monthsToReady : null;
      home = { readyMonthBefore: readyMonth(before.monthsToReady, now), readyMonthAfter: readyMonth(after.monthsToReady, now), monthsDelta: md, direction: md == null ? "unknown" : md < 0 ? "earlier" : md > 0 ? "later" : "flat" };
    }
    const g = bufferGain(a.emergencyMonthly, expenses);
    const emergency = { bufferBefore, bufferAfter: Math.round((bufferBefore + g) * 10) / 10, floorMonths: 6, direction: g > 0 ? "up" : "flat" };
    allocatedImpact = {
      allocation: a,
      home,
      emergency,
      flexible: { before: cashflowBefore, after: cashflowBaseline != null ? cashflowBaseline + a.flexibleMonthly : null, added: a.flexibleMonthly },
    };
  }

  return {
    ...base,
    mode: "freed",
    home: maxHome ? { readyMonthNow: maxHome.readyMonthNow } : null,
    availableImpact,
    allocatedImpact,
    confidence: income > 0 && context.home ? "high" : income > 0 ? "medium" : "low",
  };
}

// Standard reducing-balance months-to-payoff for a principal at a monthly
// payment. Returns null if the payment doesn't cover the interest.
export function monthsToPayoff({ principal, annualRatePercent, monthlyPayment }) {
  const p = num(principal);
  const pay = num(monthlyPayment);
  if (p <= 0) return 0;
  const r = num(annualRatePercent) / 100 / 12;
  if (pay <= p * r) return null; // never pays off
  if (r === 0) return Math.ceil(p / pay);
  return Math.ceil(Math.log(pay / (pay - p * r)) / Math.log(1 + r));
}
