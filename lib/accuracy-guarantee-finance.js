// "Recommendation accuracy accountability" (business-model idea from the differentiation
// discussion): if a recommended strategy underperforms what was projected, offer something real
// (a fee credit) instead of the standard "not guaranteed, past performance..." boilerplate every
// bank uses. This prototype has no real market data feed to observe genuine elapsed-time
// performance, so this is a concept preview the customer can explore against a hypothetical
// "actual value so far" input - same honesty discipline as Cross-Bank Data Integration's concept
// items. The formula itself and every number it produces are real, disclosed, and deterministic;
// only the "actual value" input is hypothetical.

const UNDERPERFORMANCE_THRESHOLD_PERCENT = 15; // more than this far below the pro-rated projection triggers a credit
const FEE_CREDIT_PERCENT_OF_SHORTFALL = 10; // illustrative: OCBC credits this share of the dollar shortfall

// Straight-line interpolation from $0 (elapsed = 0, nothing contributed yet) to projectedEndValue
// (elapsed = horizon) - both the contribution pace and the growth are prorated together, which
// algebraically reduces to projectedEndValue * ratio. A real compounding curve is convex, not
// linear, so this is a labeled illustrative approximation, not a restatement of the exact
// projection math - but the anchor points (0 at start, the real projection at the end) are exact.
// Correct for a recurring plan (RSP/DCA/value-averaging), where money really
// does start near $0 and build up - wrong for a lump sum, which is fully
// invested on day one and never passes through $0. When purchaseMode is
// "lump_sum" and totalContributed is known, this instead applies the growth
// curve implied by the projection itself (projectedEndValue/totalContributed,
// the real total multiple over the full horizon) pro-rated by elapsed time -
// convex like real compounding, anchored at the same two real points
// (totalContributed at elapsed=0, projectedEndValue at elapsed=horizon).
export function computeExpectedValueAtElapsed({ projectedEndValue, totalContributed, elapsedMonths, horizonMonths, purchaseMode }) {
  const ratio = horizonMonths > 0 ? Math.min(1, Math.max(0, elapsedMonths / horizonMonths)) : 0;
  if (purchaseMode === "lump_sum" && totalContributed > 0 && projectedEndValue > 0) {
    const totalGrowthMultiple = projectedEndValue / totalContributed;
    return Math.round(totalContributed * totalGrowthMultiple ** ratio);
  }
  return Math.round(projectedEndValue * ratio);
}

export function computeAccuracyGuarantee({ expectedValueAtElapsed, actualValue }) {
  const shortfall = Math.max(0, expectedValueAtElapsed - actualValue);
  const shortfallPercent = expectedValueAtElapsed > 0 ? Math.round((shortfall / expectedValueAtElapsed) * 1000) / 10 : 0;
  const triggered = shortfallPercent > UNDERPERFORMANCE_THRESHOLD_PERCENT;
  const creditAmount = triggered ? Math.round(shortfall * (FEE_CREDIT_PERCENT_OF_SHORTFALL / 100)) : 0;
  return { shortfall: Math.round(shortfall), shortfallPercent, triggered, creditAmount };
}

export { UNDERPERFORMANCE_THRESHOLD_PERCENT, FEE_CREDIT_PERCENT_OF_SHORTFALL };
