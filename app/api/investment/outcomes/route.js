import { getOrCreateSession, getAllArtifactsWithTimestamps } from "../../../../lib/investment-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";
import { getLiveQuotes } from "../../../../lib/market-quote-provider.js";
import { computeExpectedValueAtElapsed, computeAccuracyGuarantee } from "../../../../lib/accuracy-guarantee-finance.js";

export const runtime = "nodejs";

function monthsBetween(fromIso, toDate) {
  const from = new Date(fromIso);
  const months = (toDate.getFullYear() - from.getFullYear()) * 12 + (toDate.getMonth() - from.getMonth());
  const dayAdjust = toDate.getDate() < from.getDate() ? -1 : 0;
  return Math.max(0, months + dayAdjust);
}

// A pick isn't counted toward the aggregate accuracy signal (fed into
// Guardian Reputation Score) until at least this much real time has passed -
// day-to-day price noise on a fresh pick would make the signal meaningless,
// same reasoning as mirror-outcome-resolver.js's 90-day window, just a
// shorter bar since a price observation (not a binary life event) is being
// checked here.
const MIN_MONTHS_FOR_AGGREGATE = 3;

// Real predicted-vs-actual for every confirmed investment pick that has a
// real ticker AND a real quote captured at confirm time (both introduced
// together - a pre-existing pick confirmed before this feature shipped
// simply has no baseline, and correctly reports hasRealData: false rather
// than a guessed one). Turns the Accuracy Guarantee concept-preview
// (previously only explorable against a hypothetical typed-in "actual
// value") into something backed by a real, live-fetched market price -
// still never a guarantee of future performance, only a real record of
// what actually happened since confirmation.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const session = await getOrCreateSession(userId);
  const rows = await getAllArtifactsWithTimestamps(session.id, "stage1", "confirmed_investment_pick");

  const tickersNeeded = rows.filter((row) => row.payload.quote_at_confirm).map((row) => row.payload.ticker);
  const liveQuotes = await getLiveQuotes(tickersNeeded);

  const now = new Date();
  const outcomes = rows.map((row) => {
    const pick = row.payload;
    const key = `${pick.entry_id}:${row.createdAt}`;
    const baseline = pick.quote_at_confirm;
    const currentQuote = pick.ticker ? liveQuotes[pick.ticker] : null;
    if (!baseline || !currentQuote) {
      return { key, entryId: pick.entry_id, confirmedAt: row.createdAt, hasRealData: false };
    }

    const horizonMonths = pick.horizon_years * 12;
    const elapsedMonths = monthsBetween(row.createdAt, now);
    const expectedValueAtElapsed = computeExpectedValueAtElapsed({
      projectedEndValue: pick.projection.projectedEndValue,
      totalContributed: pick.projection.totalContributed,
      elapsedMonths,
      horizonMonths,
      purchaseMode: pick.purchase_mode,
    });
    // A lump sum is fully invested on day one, not spread over the holding
    // period - "contributed so far" is the whole amount from elapsedMonths=0
    // onward, a real fact, not an approximation. Only the recurring modes
    // (RSP/daily-micro-DCA/value-averaging) actually spread contributions
    // over time, where the linear elapsed/horizon ratio is a disclosed
    // approximation - same standard already applied to expectedValueAtElapsed's
    // own straight-line interpolation.
    const expectedContributedSoFar =
      pick.purchase_mode === "lump_sum"
        ? pick.projection.totalContributed
        : Math.round(pick.projection.totalContributed * (horizonMonths > 0 ? Math.min(1, elapsedMonths / horizonMonths) : 0));
    const realPriceRatio = currentQuote.price / baseline.price;
    const actualValue = Math.round(expectedContributedSoFar * realPriceRatio);

    return {
      key,
      entryId: pick.entry_id,
      confirmedAt: row.createdAt,
      hasRealData: true,
      elapsedMonths,
      expectedValueAtElapsed,
      actualValue,
      realPriceRatio: Math.round(realPriceRatio * 1000) / 1000,
      quoteAtConfirmPrice: baseline.price,
      currentPrice: currentQuote.price,
      currentPriceAsOf: currentQuote.asOf,
    };
  });

  // Real aggregate accuracy signal for Guardian Reputation Score
  // (app/page.jsx's getGuardianReputationScore) - "accurate" reuses the
  // exact same computeAccuracyGuarantee().triggered the customer already
  // sees per pick, never a separate invented threshold. Excluded (null),
  // not scored as 0, until at least one real pick has cleared
  // MIN_MONTHS_FOR_AGGREGATE - same "insufficient data is excluded"
  // pattern as every other Guardian Reputation Score component.
  const resolvable = outcomes.filter((entry) => entry.hasRealData && entry.elapsedMonths >= MIN_MONTHS_FOR_AGGREGATE);
  const accurateCount = resolvable.filter(
    (entry) => !computeAccuracyGuarantee({ expectedValueAtElapsed: entry.expectedValueAtElapsed, actualValue: entry.actualValue }).triggered
  ).length;
  const accuracy = {
    resolvedCount: resolvable.length,
    accuratePercent: resolvable.length > 0 ? Math.round((accurateCount / resolvable.length) * 100) : null,
  };

  return Response.json({ outcomes, accuracy });
}
