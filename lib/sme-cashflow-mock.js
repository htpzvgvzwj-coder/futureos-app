// Same fallback role as lib/decision-mock.js and lib/future-comparison-mock.js.

export function buildMockCashflowNarration(forecast) {
  if (!forecast.hasGap) {
    return {
      narrative: `[Simulated] No cash gap projected over the next ${forecast.horizonDays} days.`,
      key_consideration: "[Simulated] Worth re-checking after any large new commitment.",
    };
  }
  const fixNote = forecast.realFix
    ? `Delaying ${forecast.realFix.label} by ${forecast.realFix.delayDays} days would help.`
    : "No single delay closes this gap - worth reviewing several expenses together.";
  return {
    narrative: `[Simulated] Cash may run short around day ${forecast.firstGapDay}.`,
    key_consideration: `[Simulated] ${fixNote}`,
  };
}
