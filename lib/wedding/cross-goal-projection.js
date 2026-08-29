// Wedding Living Plan - real cross-goal projection (pure, no DB/AI).
//
// A wedding branch that RELEASES monthly cashflow does not push that money
// anywhere on its own. The projection returns two layers:
//
//   availableImpact  - what COULD happen: the freed amount, how far it
//                      could pull the home deposit forward, how much
//                      emergency buffer it could rebuild. Possibilities,
//                      not facts.
//   allocatedImpact  - what the customer actually chose to do with it
//                      (allocation). Only present once an allocation is set,
//                      and it only ever reflects the allocated legs.
//
// A branch that COSTS more instead returns a `pressure` block (extra
// monthly needed) and no allocation layer.

import { computeReadyDateForMonthlyAmount } from "../home-draft-finance.js";
import { normalizeAllocation, allocationSum } from "../living-plan/allocation.js";

const BUFFER_IMPACT_HORIZON_MONTHS = 12;

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function readyMonth(monthsToReady, now = new Date()) {
  if (monthsToReady == null) return null;
  const d = new Date(now);
  d.setMonth(d.getMonth() + monthsToReady);
  return d.toISOString().slice(0, 7);
}

function homeReadyAt(home, monthlyAmount, now) {
  const p = computeReadyDateForMonthlyAmount({
    downPaymentNeeded: num(home.downPaymentNeeded),
    currentSavings: num(home.currentSavings),
    monthlyAmount,
  });
  return { months: p.monthsToReady, month: readyMonth(p.monthsToReady, now) };
}

function bufferGainFromMonthly(monthlyToEmergency, monthlyExpenses) {
  if (!(monthlyExpenses > 0) || !(monthlyToEmergency > 0)) return 0;
  return Math.round(((monthlyToEmergency * BUFFER_IMPACT_HORIZON_MONTHS) / monthlyExpenses) * 10) / 10;
}

// branchFinance / realityFinance: computeWeddingPlanFinance output.
// context: { monthlyIncome, monthlyExpenses, committedExcludingWedding,
//   emergencyBufferMonths, home: { monthlyContribution, downPaymentNeeded,
//   currentSavings } | null }
// allocation: { goalMonthly, emergencyMonthly, flexibleMonthly } | null
export function projectWeddingBranchImpact({ branchFinance, realityFinance, context, allocation = null, now = new Date() }) {
  const assumptions = [
    "Freed cashflow is NOT moved anywhere until you allocate it.",
    "Home acceleration assumes the allocated amount is added on top of the current home contribution.",
    "Emergency buffer gain is projected over the next 12 months.",
    "Your partner's earmarked savings stay private; only their committed monthly contribution is counted.",
  ];

  const weddingMonthlyBefore = num(realityFinance.userRequiredMonthly ?? realityFinance.userMonthly);
  const weddingMonthlyAfter = num(branchFinance.userRequiredMonthly ?? branchFinance.userMonthly);
  const freedCashflow = weddingMonthlyBefore - weddingMonthlyAfter; // + = branch frees money

  const income = num(context.monthlyIncome);
  const expenses = num(context.monthlyExpenses);
  const committedOther = num(context.committedExcludingWedding);
  const cashflowBefore = income > 0 ? income - expenses - committedOther - weddingMonthlyBefore : null;
  const cashflowBaseline = income > 0 ? income - expenses - committedOther - weddingMonthlyAfter : null;

  const wedding = {
    userMonthlyBefore: weddingMonthlyBefore,
    userMonthlyAfter: weddingMonthlyAfter,
    delta: weddingMonthlyAfter - weddingMonthlyBefore,
    totalBefore: num(realityFinance.planTotal),
    totalAfter: num(branchFinance.planTotal),
  };

  // ---- branch changes nothing to the user's monthly share ----------
  if (Math.round(freedCashflow) === 0) {
    return {
      mode: "neutral",
      wedding,
      freedCashflow: 0,
      pressure: null,
      cashflow: { before: cashflowBefore, after: cashflowBaseline },
      home: context.home
        ? (() => {
            const b = homeReadyAt(context.home, num(context.home.monthlyContribution), now);
            return { readyMonthNow: b.month, monthsToReadyNow: b.months };
          })()
        : null,
      emergency: { bufferBefore: num(context.emergencyBufferMonths), bufferAfter: num(context.emergencyBufferMonths), floorMonths: 6, direction: "flat" },
      availableImpact: null,
      allocatedImpact: null,
      confidence: income > 0 ? "high" : "low",
      assumptions,
    };
  }

  // ---- branch COSTS more: no allocation, show the pressure -----------
  if (freedCashflow < 0) {
    return {
      mode: "pressure",
      wedding,
      freedCashflow: 0,
      pressure: { extraMonthlyNeeded: Math.round(Math.abs(freedCashflow)) },
      cashflow: { before: cashflowBefore, after: cashflowBaseline },
      home: null,
      emergency: {
        bufferBefore: num(context.emergencyBufferMonths),
        // a costlier branch that overspills free cashflow eats savings
        bufferAfter: (() => {
          const roomForWedding = income > 0 ? Math.max(0, income - expenses - committedOther) : null;
          if (roomForWedding == null || !(expenses > 0)) return num(context.emergencyBufferMonths);
          const overspill = Math.max(0, weddingMonthlyAfter - roomForWedding);
          return Math.round((num(context.emergencyBufferMonths) - bufferGainFromMonthly(overspill, expenses)) * 10) / 10;
        })(),
        floorMonths: 6,
      },
      availableImpact: null,
      allocatedImpact: null,
      confidence: income > 0 ? "high" : "low",
      assumptions,
    };
  }

  // ---- branch FREES money: availableImpact + (maybe) allocatedImpact -
  const bufferBefore = num(context.emergencyBufferMonths);

  // availableImpact - the full possibility if ALL freed money went to one leg
  let maxHome = null;
  if (context.home && num(context.home.downPaymentNeeded) > 0) {
    const homeMonthlyNow = num(context.home.monthlyContribution);
    const before = homeReadyAt(context.home, homeMonthlyNow, now);
    const maxAfter = homeReadyAt(context.home, homeMonthlyNow + freedCashflow, now);
    maxHome = {
      readyMonthNow: before.month,
      monthsToReadyNow: before.months,
      maxReadyMonth: maxAfter.month,
      maxMonthsEarlier:
        before.months != null && maxAfter.months != null ? Math.max(0, before.months - maxAfter.months) : null,
    };
  }
  const maxBufferGain = bufferGainFromMonthly(freedCashflow, expenses);
  const availableImpact = {
    freedCashflow: Math.round(freedCashflow),
    unallocated: Math.round(freedCashflow - allocationSum(allocation)),
    maxHomeMonthsEarlier: maxHome?.maxMonthsEarlier ?? null,
    maxHomeReadyMonth: maxHome?.maxReadyMonth ?? null,
    homeReadyMonthNow: maxHome?.readyMonthNow ?? null,
    maxEmergencyBufferAfter: expenses > 0 ? Math.round((bufferBefore + maxBufferGain) * 10) / 10 : bufferBefore,
    maxCashflowAfter: cashflowBaseline,
    note: "possible_not_committed",
  };

  // allocatedImpact - ONLY the legs the customer actually set
  let allocatedImpact = null;
  const a = normalizeAllocation(allocation);
  if (allocationSum(a) > 0) {
    let home = null;
    if (context.home && num(context.home.downPaymentNeeded) > 0) {
      const homeMonthlyBefore = num(context.home.monthlyContribution);
      const homeMonthlyAfter = homeMonthlyBefore + a.goalMonthly;
      const before = homeReadyAt(context.home, homeMonthlyBefore, now);
      const after = homeReadyAt(context.home, homeMonthlyAfter, now);
      const monthsDelta =
        before.months != null && after.months != null ? after.months - before.months : null;
      home = {
        monthlyBefore: homeMonthlyBefore,
        monthlyAfter: homeMonthlyAfter,
        readyMonthBefore: before.month,
        readyMonthAfter: after.month,
        monthsToReadyBefore: before.months,
        monthsToReadyAfter: after.months,
        monthsDelta,
        direction: monthsDelta == null ? "unknown" : monthsDelta < 0 ? "earlier" : monthsDelta > 0 ? "later" : "flat",
      };
    }
    const bufGain = bufferGainFromMonthly(a.emergencyMonthly, expenses);
    const emergency = {
      bufferBefore,
      bufferAfter: Math.round((bufferBefore + bufGain) * 10) / 10,
      floorMonths: 6,
      safeBefore: bufferBefore >= 6,
      safeAfter: bufferBefore + bufGain >= 6,
      direction: bufGain > 0 ? "up" : "flat",
    };
    const flexibleAfter = cashflowBaseline != null ? cashflowBaseline + a.flexibleMonthly : null;
    allocatedImpact = {
      allocation: a,
      home,
      emergency,
      flexible: { before: cashflowBefore, after: flexibleAfter, added: a.flexibleMonthly },
      affectedCommitments: [
        ...(home && home.monthsDelta ? [{ goal: "home", metric: "readyMonth", monthsDelta: home.monthsDelta }] : []),
        ...(emergency.direction !== "flat"
          ? [{ goal: "emergency", metric: "bufferMonths", delta: Math.round((emergency.bufferAfter - bufferBefore) * 10) / 10 }]
          : []),
      ],
    };
  }

  return {
    mode: "freed",
    wedding,
    freedCashflow: Math.round(freedCashflow),
    cashflow: { before: cashflowBefore, baseline: cashflowBaseline },
    availableImpact,
    allocatedImpact,
    // Emergency/Home "current" (pre-allocation) - so the field can show the
    // unchanged node when no allocation is set.
    home: context.home
      ? { readyMonthNow: maxHome?.readyMonthNow ?? null, monthsToReadyNow: maxHome?.monthsToReadyNow ?? null }
      : null,
    emergency: { bufferBefore, bufferAfter: bufferBefore, floorMonths: 6, direction: "flat" },
    confidence: income > 0 && context.home ? "high" : income > 0 ? "medium" : "low",
    assumptions,
  };
}
