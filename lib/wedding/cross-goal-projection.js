// Wedding Living Plan - real cross-goal projection (pure, no DB/AI).
//
// Given a wedding branch's finance vs the reality path's finance, and the
// couple's real cashflow / home plan / emergency buffer, project what the
// branch actually does to:
//   - the user's monthly wedding contribution
//   - free monthly cashflow
//   - the Home deposit ready date
//   - the Emergency fund buffer
//   - other already-committed goals
//
// Every number is derived here; assumptions are returned alongside, not
// hidden. Home and Emergency nodes on the Future Field move by THIS.

import { computeReadyDateForMonthlyAmount } from "../home-draft-finance.js";

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

// branchFinance / realityFinance: output of computeWeddingPlanFinance.
// context: {
//   monthlyIncome, monthlyExpenses,
//   committedExcludingWedding,          // every other confirmed monthly outflow
//   emergencyBufferMonths,
//   home: { monthlyContribution, downPaymentNeeded, currentSavings } | null
// }
export function projectWeddingBranchImpact({ branchFinance, realityFinance, context, now = new Date() }) {
  const assumptions = [
    "Freed wedding contribution is assumed available to accelerate the home deposit.",
    "Emergency buffer impact is projected over the next 12 months.",
    "Partner's earmarked savings stay private; only their committed monthly contribution is counted.",
  ];

  const weddingMonthlyBefore = num(realityFinance.userRequiredMonthly ?? realityFinance.userMonthly);
  const weddingMonthlyAfter = num(branchFinance.userRequiredMonthly ?? branchFinance.userMonthly);
  const freedCashflow = weddingMonthlyBefore - weddingMonthlyAfter; // + = the branch frees money

  // ---- Cashflow -------------------------------------------------------
  const income = num(context.monthlyIncome);
  const expenses = num(context.monthlyExpenses);
  const committedOther = num(context.committedExcludingWedding);
  const cashflowBefore = income > 0 ? income - expenses - committedOther - weddingMonthlyBefore : null;
  const cashflowAfter = income > 0 ? income - expenses - committedOther - weddingMonthlyAfter : null;

  // ---- Home deposit -------------------------------------------------
  let home = null;
  if (context.home && context.home.downPaymentNeeded > 0) {
    const homeMonthlyBefore = num(context.home.monthlyContribution);
    // The branch makes `freedCashflow` available on top of the current home
    // contribution (or removes it, if the branch costs more).
    const homeMonthlyAfter = Math.max(0, homeMonthlyBefore + freedCashflow);
    const before = computeReadyDateForMonthlyAmount({
      downPaymentNeeded: context.home.downPaymentNeeded,
      currentSavings: num(context.home.currentSavings),
      monthlyAmount: homeMonthlyBefore,
    });
    const after = computeReadyDateForMonthlyAmount({
      downPaymentNeeded: context.home.downPaymentNeeded,
      currentSavings: num(context.home.currentSavings),
      monthlyAmount: homeMonthlyAfter,
    });
    const monthsDelta =
      before.monthsToReady != null && after.monthsToReady != null
        ? after.monthsToReady - before.monthsToReady // negative = earlier
        : null;
    home = {
      monthlyBefore: homeMonthlyBefore,
      monthlyAfter: homeMonthlyAfter,
      readyMonthBefore: readyMonth(before.monthsToReady, now),
      readyMonthAfter: readyMonth(after.monthsToReady, now),
      monthsToReadyBefore: before.monthsToReady,
      monthsToReadyAfter: after.monthsToReady,
      monthsDelta,
      direction: monthsDelta == null ? "unknown" : monthsDelta < 0 ? "earlier" : monthsDelta > 0 ? "later" : "flat",
    };
  }

  // ---- Emergency fund -------------------------------------------------
  // If the branch's wedding contribution fits inside free cashflow, the
  // buffer is untouched. If it exceeds free cashflow, the excess is drawn
  // from savings, reducing the buffer over the horizon.
  const bufferBefore = num(context.emergencyBufferMonths);
  const roomForWedding = income > 0 ? Math.max(0, income - expenses - committedOther) : null;
  let bufferAfter = bufferBefore;
  if (roomForWedding != null && expenses > 0) {
    const overspill = Math.max(0, weddingMonthlyAfter - roomForWedding);
    const bufferMonthsLost = Math.round(((overspill * BUFFER_IMPACT_HORIZON_MONTHS) / expenses) * 10) / 10;
    bufferAfter = Math.round((bufferBefore - bufferMonthsLost) * 10) / 10;
  }
  const emergency = {
    bufferBefore,
    bufferAfter,
    floorMonths: 6,
    safeBefore: bufferBefore >= 6,
    safeAfter: bufferAfter >= 6,
    direction: bufferAfter < bufferBefore ? "down" : bufferAfter > bufferBefore ? "up" : "flat",
  };

  // ---- Affected commitments ----------------------------------------
  const affectedCommitments = [];
  if (home && home.monthsDelta != null && home.monthsDelta !== 0) {
    affectedCommitments.push({ goal: "home", metric: "readyMonth", monthsDelta: home.monthsDelta });
  }
  if (emergency.direction !== "flat") {
    affectedCommitments.push({ goal: "emergency", metric: "bufferMonths", delta: Math.round((emergency.bufferAfter - emergency.bufferBefore) * 10) / 10 });
  }

  // Confidence: high when we have real income + home data; medium when
  // cashflow is unknown (no logged/declared income).
  const confidence = income > 0 && context.home ? "high" : income > 0 ? "medium" : "low";

  return {
    wedding: {
      userMonthlyBefore: weddingMonthlyBefore,
      userMonthlyAfter: weddingMonthlyAfter,
      delta: weddingMonthlyAfter - weddingMonthlyBefore,
      totalBefore: num(realityFinance.planTotal),
      totalAfter: num(branchFinance.planTotal),
    },
    cashflow: { before: cashflowBefore, after: cashflowAfter, freed: freedCashflow },
    home,
    emergency,
    affectedCommitments,
    confidence,
    assumptions,
  };
}
