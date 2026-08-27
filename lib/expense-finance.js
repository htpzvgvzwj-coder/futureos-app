// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// Mirrors lib/income-finance.js exactly: turns a real expense_entries
// history into one effective monthly-expense number every consumer in the
// app reads (manualEntryProvider.getProfile in app/page.jsx, the same
// funnel monthlyIncome already flows through), plus a real trend so a
// planner can honestly say expenses are rising/falling instead of
// guessing or staying silent.

// Same insufficient-signal floor as lib/income-finance.js - below this
// many real logged months, smoothing or judging a trend would be a guess.
const MIN_ENTRIES_FOR_SMOOTHING = 3;
const TRAILING_MONTHS = 6;
const IRREGULAR_THRESHOLD = 0.25; // coefficient of variation

export function computeSmoothedExpenses(history, statedExpenses) {
  const real = (Array.isArray(history) ? history : [])
    .map((entry) => Number(entry.amount))
    .filter(Number.isFinite)
    .slice(0, TRAILING_MONTHS);

  if (real.length < MIN_ENTRIES_FOR_SMOOTHING) {
    return { effectiveMonthlyExpenses: statedExpenses, isIrregular: false, coefficientOfVariation: null, sampleSize: real.length };
  }

  const sorted = [...real].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const mean = real.reduce((sum, value) => sum + value, 0) / real.length;
  const variance = real.reduce((sum, value) => sum + (value - mean) ** 2, 0) / real.length;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

  return {
    effectiveMonthlyExpenses: Math.round(median),
    isIrregular: coefficientOfVariation > IRREGULAR_THRESHOLD,
    coefficientOfVariation,
    sampleSize: real.length,
  };
}

// Same real earlier-half-vs-later-half comparison as lib/personal-
// economy-finance.js's computeIncomeGrowth, applied to expenses instead
// of income - this is the real number a proactive "you're behind
// schedule, here's why" moment needs, never a guessed cause.
function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function computeExpenseTrend(history) {
  const real = (Array.isArray(history) ? history : [])
    .map((entry) => ({ month: entry.entry_month, amount: Number(entry.amount) }))
    .filter((entry) => Number.isFinite(entry.amount) && entry.month)
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  if (real.length < MIN_ENTRIES_FOR_SMOOTHING) return { hasEnoughHistory: false, sampleSize: real.length };

  const midpoint = Math.floor(real.length / 2);
  const earlierHalf = real.slice(0, midpoint || 1);
  const laterHalf = real.slice(midpoint || 1);
  const earlierAvg = earlierHalf.reduce((sum, entry) => sum + entry.amount, 0) / earlierHalf.length;
  const laterAvg = laterHalf.reduce((sum, entry) => sum + entry.amount, 0) / laterHalf.length;
  const changeAmount = Math.round(laterAvg - earlierAvg);
  const changePercent = earlierAvg > 0 ? roundToOneDecimal((changeAmount / earlierAvg) * 100) : null;

  return {
    hasEnoughHistory: true,
    sampleSize: real.length,
    earlierAvg: Math.round(earlierAvg),
    laterAvg: Math.round(laterAvg),
    changeAmount,
    changePercent,
    direction: changeAmount > 0 ? "up" : changeAmount < 0 ? "down" : "flat",
  };
}
