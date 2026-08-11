// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// Turns a real income-entries history into one effective monthly-income number
// every consumer in the app reads (see manualEntryProvider.getProfile in
// app/page.jsx, the single funnel every screen/route's "monthlyIncome" flows
// through).

// Below this many real logged months, judging "irregular" would be a guess -
// same insufficient-signal floor lib/mirror-outcome-resolver.js already uses
// elsewhere in this app. Falls back to the customer's own stated figure
// verbatim, so a customer who never logs a single entry sees zero behavior
// change from before this feature existed.
const MIN_ENTRIES_FOR_SMOOTHING = 3;
const TRAILING_MONTHS = 6;
const IRREGULAR_THRESHOLD = 0.25; // coefficient of variation

export function computeSmoothedIncome(history, statedIncome) {
  const real = (Array.isArray(history) ? history : [])
    .map((entry) => Number(entry.amount))
    .filter(Number.isFinite)
    .slice(0, TRAILING_MONTHS);

  if (real.length < MIN_ENTRIES_FOR_SMOOTHING) {
    return { effectiveMonthlyIncome: statedIncome, isIrregular: false, coefficientOfVariation: null, sampleSize: real.length };
  }

  const sorted = [...real].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const mean = real.reduce((sum, value) => sum + value, 0) / real.length;
  const variance = real.reduce((sum, value) => sum + (value - mean) ** 2, 0) / real.length;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

  return {
    effectiveMonthlyIncome: Math.round(median),
    isIrregular: coefficientOfVariation > IRREGULAR_THRESHOLD,
    coefficientOfVariation,
    sampleSize: real.length,
  };
}
