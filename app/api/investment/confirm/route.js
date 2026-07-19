import { confirmInvestmentSchema } from "../../../../lib/investment-validation.js";
import { getOtherGoalsMonthlyCommitment } from "../../../../lib/investment-context.js";
import { INVESTMENT_CATALOG } from "../../../../lib/investment-catalog.js";
import {
  projectPurchaseMode,
  deriveCommitmentForFutureScore,
  scoreInvestmentCandidate,
  computeInvestmentFutureScore,
} from "../../../../lib/investment-finance.js";
import { DEFAULT_PROFILE_KEY, getLatestArtifact, getOrCreateSession, saveArtifact, updateSessionStatus } from "../../../../lib/investment-store.js";

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

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
  const intake = await getLatestArtifact(session.id, "stage1", "intake");
  if (!intake) {
    return Response.json({ error: "no_intake" }, { status: 400 });
  }

  const otherGoals = await getOtherGoalsMonthlyCommitment();
  const availableMonthlyCashflow = Math.max(0, monthlyIncome - monthlyExpenses - otherGoals.total);

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
    currentSavings,
    otherGoalsMonthlyOutflow: otherGoals.total,
    diversificationScore: candidateScore.diversification_score,
    horizonFitScore: candidateScore.horizon_fit_score,
  });

  const result = {
    entry_id: entry.id,
    name: entry.name,
    ticker: entry.ticker,
    instrument_type: entry.instrumentType,
    market: entry.market,
    purchase_mode: purchaseMode,
    amount,
    horizon_years: horizonYears,
    projection,
    ...futureScore,
  };

  await saveArtifact(session.id, "stage1", "confirmed_investment_pick", result);
  await updateSessionStatus(session.id, { stage1Status: "confirmed" });

  return Response.json({ type: "confirm_investment", data: result });
}
