import { confirmInvestmentSchema } from "../../../../lib/investment-validation.js";
import { getOtherGoalsMonthlyCommitment } from "../../../../lib/investment-context.js";
import { resolveAvailableLiquidSavings } from "../../../../lib/liquid-savings-context.js";
import { INVESTMENT_CATALOG } from "../../../../lib/investment-catalog.js";
import {
  projectPurchaseMode,
  deriveCommitmentForFutureScore,
  scoreInvestmentCandidate,
  computeInvestmentFutureScore,
} from "../../../../lib/investment-finance.js";
import { getLatestArtifact, getOrCreateSession, saveArtifact, updateSessionStatus } from "../../../../lib/investment-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";
import { triggerCrossGoalCheck } from "../../../../lib/guardian-alert-store.js";
import { getLiveQuotes } from "../../../../lib/market-quote-provider.js";

export const runtime = "nodejs";

// No AI call here — instrument/mode/amount selection is a structured UI
// pick with nothing for an LLM to interpret, so this validates and computes
// directly. The catalog entry is looked up server-side by id — the client's
// own copy of instrument fields (name, ticker, expected return, etc.) is
// never trusted — and the server independently recomputes cashflow,
// projection, and Future Score rather than trusting anything the client
// sent beyond the categorical pick + profile inputs, exactly like every
// other confirm endpoint in this app.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = confirmInvestmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const { entryId, purchaseMode, amount, horizonYears, monthlyIncome, monthlyExpenses, currentSavings } = parsed.data;

  const entry = INVESTMENT_CATALOG.find((item) => item.id === entryId);
  if (!entry) {
    return Response.json({ error: "unknown_entry" }, { status: 404 });
  }
  if (!entry.supportedPurchaseModes.includes(purchaseMode)) {
    return Response.json({ error: "unsupported_purchase_mode" }, { status: 422 });
  }

  const session = await getOrCreateSession(userId);
  const intake = await getLatestArtifact(session.id, "stage1", "intake");
  if (!intake) {
    return Response.json({ error: "no_intake" }, { status: 400 });
  }

  const otherGoals = await getOtherGoalsMonthlyCommitment(userId);
  const availableMonthlyCashflow = Math.max(0, monthlyIncome - monthlyExpenses - otherGoals.total);
  // Server-truth available liquid savings - already nets out any PRIOR
  // confirmed lump-sum pick, since this new pick hasn't been saved yet at
  // this point. See lib/liquid-savings-context.js.
  // "flexible" horizon - a voluntary investment purchase is never urgent,
  // so market-exposed "liquid" holdings can count as available too. See
  // lib/asset-finance.js's computeAvailableSavings.
  const availableSavings = await resolveAvailableLiquidSavings(userId, currentSavings, "flexible");

  const candidateScore = scoreInvestmentCandidate(entry, {
    riskBand: intake.riskPreference,
    holdingsCategories: intake.holdingsCategories,
    availableMonthlyCashflow,
    horizonYears,
    purchaseMode,
  });

  const projection = projectPurchaseMode({ mode: purchaseMode, entry, amount, horizonYears });
  const { monthlyCommitment, lumpSumUsed } = deriveCommitmentForFutureScore(purchaseMode, amount, projection);

  const futureScore = computeInvestmentFutureScore({
    monthlyCommitment,
    lumpSumUsed,
    monthlyIncome,
    monthlyExpenses,
    currentSavings: availableSavings,
    otherGoalsMonthlyOutflow: otherGoals.total,
    diversificationScore: candidateScore.diversification_score,
    horizonFitScore: candidateScore.horizon_fit_score,
  });

  // Real live price at the moment of confirm (lib/market-quote-provider.js) -
  // the baseline a later real predicted-vs-actual comparison needs
  // (app/api/investment/outcomes/route.js). null when there's no real
  // ticker or the live fetch fails right now - never guessed or backfilled
  // later, so a pick either has a real baseline or honestly has none.
  const quoteAtConfirm = entry.ticker ? (await getLiveQuotes([entry.ticker]))[entry.ticker] ?? null : null;

  const result = {
    entry_id: entry.id,
    name: entry.name,
    ticker: entry.ticker,
    instrument_type: entry.instrumentType,
    market: entry.market,
    purchase_mode: purchaseMode,
    amount,
    horizon_years: horizonYears,
    quote_at_confirm: quoteAtConfirm,
    projection,
    // Persisted so a later real cross-goal impact recompute (lib/cross-goal-
    // context.js) can reproduce computeInvestmentFutureScore's full formula -
    // these two components are fixed properties of THIS pick (instrument mix,
    // horizon fit), unaffected by any other goal confirmed later, so they
    // don't need to be recomputed, only carried forward.
    diversification_score: candidateScore.diversification_score,
    horizon_fit_score: candidateScore.horizon_fit_score,
    ...futureScore,
  };

  const createdAt = await saveArtifact(session.id, "stage1", "confirmed_investment_pick", result);
  await updateSessionStatus(session.id, { stage1Status: "confirmed" });
  await triggerCrossGoalCheck(userId, "investment", { monthlyIncome, monthlyExpenses, currentSavings: availableSavings });

  return Response.json({ type: "confirm_investment", data: result, confirmedAt: createdAt });
}
