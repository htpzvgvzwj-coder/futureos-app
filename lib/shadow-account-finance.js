// Pure computation, no DB/AI - same discipline as every other lib/*-finance.js.
// "Shadow Account": a real backward-looking comparison between the
// customer's own real logged income history (income_entries, via
// lib/income-store.js / preferences.incomeHistory) and what a common
// savings-rate guideline applied to that same real income would have
// produced. Reuses lib/peer-benchmark.js's getTypicalSavingsRatePercent -
// already disclosed there as an illustrative guideline, not personalized
// or AI-invented - so this feature introduces zero new fabricated numbers.

// Below this many real logged months, a cumulative comparison would be
// mostly noise - same insufficient-signal floor lib/income-finance.js
// already uses for income smoothing.
const MIN_MONTHS_FOR_SHADOW = 3;

export function computeShadowAccount(incomeHistory, { currentSavings, guidelineRatePercent }) {
  const realAmounts = (Array.isArray(incomeHistory) ? incomeHistory : [])
    .map((entry) => Number(entry.amount))
    .filter(Number.isFinite);

  if (realAmounts.length < MIN_MONTHS_FOR_SHADOW) {
    return { hasHistory: false, sampleSize: realAmounts.length };
  }

  const shadowBalance = Math.round(realAmounts.reduce((sum, amount) => sum + (amount * guidelineRatePercent) / 100, 0));
  const actualSavings = Math.round(currentSavings);

  return {
    hasHistory: true,
    sampleSize: realAmounts.length,
    guidelineRatePercent,
    shadowBalance,
    actualSavings,
    gap: shadowBalance - actualSavings,
    aheadOfShadow: actualSavings >= shadowBalance,
  };
}
