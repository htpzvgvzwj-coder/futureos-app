// Same fallback role as lib/decision-mock.js - only ever supplies narrative text, never a number.
// Kept to one short line each, matching the real AI path's new brevity bar.

export function buildMockFutureComparisonNarration(savingsDelta) {
  if (savingsDelta > 0) {
    return {
      narrative: `[Simulated] Waiting leaves you SGD ${savingsDelta} better off at this horizon.`,
      key_consideration: "[Simulated] Worth checking if the price will still be available if you wait.",
    };
  }
  return {
    narrative: "[Simulated] Buying now barely changes your position versus waiting.",
    key_consideration: "[Simulated] The timing matters less here than whether you actually need it now.",
  };
}
