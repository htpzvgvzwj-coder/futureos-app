// Deterministic engine for event-triggered micro-insurance top-ups - this is the "insurance" idea
// from Cross-Bank Data Integration's concept preview made real, triggered off a real event already
// in this app (confirming a new loan) rather than only illustrated with a static example. Same "AI
// touches zero numbers" discipline as every other *-finance.js module: no AI is involved at all
// here, the trigger and every figure are pure arithmetic.
//
// Rate is an illustrative Singapore-market healthy-adult term-insurance premium rate - re-verify
// before relying on this in a non-prototype context, same disclaimer as every other rate table in
// this codebase.

const MONTHLY_PREMIUM_RATE_PER_1000_COVERAGE = 0.35;

export function computeCoverageGap({ existingCoverageAmount, totalLiabilities }) {
  const gapAmount = Math.max(0, Math.round(totalLiabilities - existingCoverageAmount));
  return { gapAmount, hasGap: gapAmount > 0 };
}

export function computeMicroTopUp({ gapAmount, durationMonths = 6 }) {
  const monthlyPremium = Math.round(((gapAmount / 1000) * MONTHLY_PREMIUM_RATE_PER_1000_COVERAGE) * 100) / 100;
  const totalPremium = Math.round(monthlyPremium * durationMonths * 100) / 100;
  return { gapAmount, durationMonths, monthlyPremium, totalPremium };
}
