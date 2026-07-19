import { investmentIntakeSchema } from "../../../../lib/investment-validation.js";
import { getOtherGoalsMonthlyCommitment } from "../../../../lib/investment-context.js";
import { shortlistInvestments, projectPurchaseMode } from "../../../../lib/investment-finance.js";
import { INVESTMENT_CATALOG } from "../../../../lib/investment-catalog.js";
import { DEFAULT_PROFILE_KEY, getOrCreateSession, saveArtifact } from "../../../../lib/investment-store.js";

export const runtime = "nodejs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// A starting point for the shortlist's live-preview numbers only — the
// customer sets their real amount at selection time. Never persisted as a
// commitment; purely a reasonable default so the shortlist screen shows
// non-zero projections before the customer has touched anything.
function computeDefaultPreviewAmount(purchaseMode, availableMonthlyCashflow) {
  if (purchaseMode === "lump_sum") return clamp(Math.round(availableMonthlyCashflow * 3), 500, 20000);
  if (purchaseMode === "daily_micro_dca") return clamp(Math.round((availableMonthlyCashflow * 0.3) / 21), 5, 200);
  return clamp(Math.round(availableMonthlyCashflow * 0.3), 50, 5000);
}

// No AI call here — the shortlist is entirely code-computed (see
// lib/investment-catalog.js's header comment for why this domain holds
// numbers/product-selection to a stricter "no AI" bar than every other
// domain). Server recomputes availableMonthlyCashflow itself rather than
// trusting a client-sent figure, same discipline as every confirm endpoint
// in this app.
export async function POST(request) {
  const body = await request.json();
  const parsed = investmentIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const { riskPreference, goalCategory, horizonYears, customTargetAmount, holdingsCategories, purchaseMode, monthlyIncome, monthlyExpenses } =
    parsed.data;

  const otherGoals = await getOtherGoalsMonthlyCommitment();
  const availableMonthlyCashflow = Math.max(0, monthlyIncome - monthlyExpenses - otherGoals.total);

  const shortlist = shortlistInvestments({
    riskBand: riskPreference,
    markets: ["sg", "global"],
    holdingsCategories,
    availableMonthlyCashflow,
    horizonYears,
    purchaseMode,
  });

  const previewAmount = computeDefaultPreviewAmount(purchaseMode, availableMonthlyCashflow);
  const shortlistWithPreview = shortlist.map((item) => {
    const entry = INVESTMENT_CATALOG.find((catalogEntry) => catalogEntry.id === item.entry_id);
    return { ...item, projection: projectPurchaseMode({ mode: purchaseMode, entry, amount: previewAmount, horizonYears }) };
  });

  const intake = { riskPreference, goalCategory, horizonYears, customTargetAmount: customTargetAmount ?? null, holdingsCategories, purchaseMode };

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
  await saveArtifact(session.id, "stage1", "intake", intake);
  await saveArtifact(session.id, "stage1", "shortlist", { items: shortlistWithPreview, previewAmount });

  return Response.json({
    sessionId: session.id,
    intake,
    shortlist: shortlistWithPreview,
    previewAmount,
    availableMonthlyCashflow,
  });
}
