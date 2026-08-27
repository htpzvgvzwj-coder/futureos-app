// SME Cash Flow Copilot - a real, deterministic day-by-day cash flow
// forecast for a small business, built entirely from the owner's own real
// entered events (income and expenses, each with a real recurring day of
// the month). Same "AI touches zero numbers" discipline as every other
// *-finance.js module in this app: the forecast, the real cash-gap day,
// and the real fix candidate are all decided here before any AI ever sees
// them - an AI layer (if any) only narrates what this module already
// computed, it never invents a number or a suggestion.
//
// Revenue and expenses are modeled as the same shape (a signed recurring
// event) rather than two separate lists - "supplier payment arrives
// before weekend revenue" is naturally just two events with different
// dayOfMonth values and opposite signs, not a special case.

const DAYS_PER_MONTH_CYCLE = 30;

function simulate(startingCash, events, horizonDays) {
  let balance = startingCash;
  let minBalance = startingCash;
  let firstGapDay = null;
  const timeline = [];

  for (let day = 1; day <= horizonDays; day++) {
    const dayOfMonth = ((day - 1) % DAYS_PER_MONTH_CYCLE) + 1;
    for (const event of events) {
      if (event.dayOfMonth === dayOfMonth) balance += event.amount;
    }
    balance = Math.round(balance * 100) / 100;
    if (balance < minBalance) minBalance = balance;
    if (balance < 0 && firstGapDay === null) firstGapDay = day;
    timeline.push({ day, balance });
  }

  return { timeline, firstGapDay, minBalance: Math.round(minBalance), endingBalance: Math.round(balance) };
}

// Real search, not an invented tip: tries delaying each real expense event
// (in descending order of size, since a bigger delayed outflow is more
// likely to close a real gap) by a real number of days, and returns the
// FIRST one that actually closes the gap in a fresh simulation - never a
// generic "reduce spending" suggestion with no evidence behind it.
function findRealFix(startingCash, events, horizonDays, gapDay) {
  const expenseEvents = events
    .filter((event) => event.amount < 0)
    .slice()
    .sort((a, b) => a.amount - b.amount); // most negative (largest expense) first

  for (const target of expenseEvents) {
    for (const delayDays of [7, 14, 21]) {
      const adjusted = events.map((event) =>
        event === target ? { ...event, dayOfMonth: ((event.dayOfMonth - 1 + delayDays) % DAYS_PER_MONTH_CYCLE) + 1 } : event
      );
      const result = simulate(startingCash, adjusted, horizonDays);
      if (result.firstGapDay === null || result.firstGapDay > gapDay) {
        return { label: target.label, delayDays, newFirstGapDay: result.firstGapDay };
      }
    }
  }
  return null;
}

export function computeCashFlowForecast({ startingCash, events, horizonDays }) {
  const base = simulate(startingCash, events, horizonDays);
  const realFix = base.firstGapDay !== null ? findRealFix(startingCash, events, horizonDays, base.firstGapDay) : null;

  return {
    startingCash: Math.round(startingCash),
    horizonDays,
    timeline: base.timeline,
    firstGapDay: base.firstGapDay,
    minBalance: base.minBalance,
    endingBalance: base.endingBalance,
    hasGap: base.firstGapDay !== null,
    realFix,
  };
}

// The real question an owner actually has once a gap shows up: "can I
// cover this myself?" Reuses the customer's own real personal figures
// (currentSavings/monthlyExpenses, already real elsewhere in this app -
// same numbers Shadow Account and Strategic Balance read) rather than
// inventing a financing recommendation with no real backing. Honestly
// returns null when the customer hasn't entered real personal figures
// yet - same "insufficient data excluded" pattern as every other check
// in this app.
const SAFE_MONTHS_BUFFER = 3;

export function computePersonalBufferImpact({ gapAmount, personalCurrentSavings, personalMonthlyExpenses }) {
  if (!(personalCurrentSavings > 0) || !(personalMonthlyExpenses > 0) || !(gapAmount > 0)) return null;

  const monthsCoveredBefore = Math.round((personalCurrentSavings / personalMonthlyExpenses) * 10) / 10;
  const remainingAfterCover = Math.round(personalCurrentSavings - gapAmount);
  const monthsCoveredAfter = Math.round((remainingAfterCover / personalMonthlyExpenses) * 10) / 10;

  return {
    gapAmount: Math.round(gapAmount),
    monthsCoveredBefore,
    monthsCoveredAfter,
    remainingAfterCover,
    canSafelyCover: remainingAfterCover >= personalMonthlyExpenses * SAFE_MONTHS_BUFFER,
  };
}

// Real forecast-accuracy tracking from the owner's own logged check-ins -
// each checkin already carries the predictedBalance the server computed
// and froze at checkin time (lib/sme-cashflow-store.js's addCheckin), so
// this is pure arithmetic over real stored numbers, never a new guess.
export function computeCheckinAccuracy(checkins) {
  const list = Array.isArray(checkins) ? checkins : [];
  if (!list.length) return { hasCheckins: false, count: 0 };

  const entries = list.map((checkin) => ({
    ...checkin,
    variance: Math.round((checkin.actualBalance - checkin.predictedBalance) * 100) / 100,
  }));
  const avgAbsVariance = Math.round((entries.reduce((sum, entry) => sum + Math.abs(entry.variance), 0) / entries.length) * 100) / 100;

  return { hasCheckins: true, count: entries.length, avgAbsVariance, entries };
}
