// Cross-domain read layer that fixes double-counting of currentSavings:
// every domain (wedding/home/retirement/loan/emergency/other) used to treat
// the full currentSavings figure as independently available, unaware that a
// confirmed lump-sum investment purchase already drew part of it down.
// Mirrors the parallel-store-reads-no-SQL-join pattern established by
// lib/loan-context.js / lib/investment-context.js / lib/hardship-context.js.

import { listAssets } from "./asset-store.js";
import { computeAvailableSavings, computeInsuranceCoverage } from "./asset-finance.js";
import * as investmentStore from "./investment-store.js";

function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Only `purchase_mode: "lump_sum"` draws money out of the liquid pool
// immediately upon confirmation - RSP/daily-micro-DCA/value-averaging are
// future monthly contribution plans, not an immediate withdrawal, so they
// don't reduce today's available liquid savings.
export async function getConfirmedInvestmentLumpSumTotal(profileKey) {
  const session = await investmentStore.getOrCreateSession(profileKey);
  const picks = await investmentStore.getAllArtifactsWithTimestamps(session.id, "stage1", "confirmed_investment_pick");
  return picks.reduce((sum, { payload }) => {
    if (payload.purchase_mode !== "lump_sum") return sum;
    return sum + numberValue(payload.amount, 0);
  }, 0);
}

// Server-truth "available liquid savings" for any domain's confirm/propose
// computation. Once the customer has logged any real asset, this ignores
// the client-sent figure entirely and uses computeAvailableSavings() against
// the real ledger (lib/asset-finance.js) - same reasoning every confirm
// route already applies to otherGoalsMonthlyOutflow ("a stale or failed
// client fetch here can never corrupt what gets persisted"). Falls back to
// the client-sent value verbatim when no assets exist yet - zero regression
// for a customer who hasn't touched the Asset Profile ledger, matching
// manualEntryProvider's override philosophy in app/page.jsx (the flat
// legacy number can't be liquidity-tiered, so it's used as-is regardless of
// horizon).
//
// `horizon`: "tight" (cash + near_cash only) for near-term/urgent needs
// where forcing a sale of a market-exposed asset would be a bad idea
// (emergency fund, a wedding a few months out, or any goal with an unknown
// timeline where the conservative pool is the safer default); "flexible"
// (+ liquid) for goals with years of runway to plan a sale (home down
// payment, retirement, a voluntary investment). See
// lib/asset-finance.js's computeAvailableSavings for the full tier
// definitions.
export async function resolveAvailableLiquidSavings(profileKey, clientSentCurrentSavings, horizon = "flexible") {
  const assets = await listAssets(profileKey);
  const baseline = assets.length > 0 ? computeAvailableSavings(assets, horizon) : numberValue(clientSentCurrentSavings, 0);
  const lumpCommitted = await getConfirmedInvestmentLumpSumTotal(profileKey);
  return Math.max(0, baseline - lumpCommitted);
}

// One-stop resolution for domains whose AI prompt cites real asset context
// (wedding/home/retirement/other stage2 savings-plan prompts) - the same
// resolveAvailableLiquidSavings math, plus an emergency-buffer-months figure
// and real insurance status computed from the same asset list, so the
// prompt can explicitly cite "real Asset Profile ledger" data the way
// lib/mirror-prompts.js already does, instead of a silently-substituted
// number with no framing.
export async function resolveAssetPromptContext(profileKey, clientSentCurrentSavings, monthlyExpenses, horizon = "flexible") {
  const assets = await listAssets(profileKey);
  const baseline = assets.length > 0 ? computeAvailableSavings(assets, horizon) : numberValue(clientSentCurrentSavings, 0);
  const lumpCommitted = await getConfirmedInvestmentLumpSumTotal(profileKey);
  const availableLiquidSavings = Math.max(0, baseline - lumpCommitted);
  const expenses = numberValue(monthlyExpenses, 0);
  return {
    availableLiquidSavings,
    emergencyBufferMonths: expenses > 0 ? Math.round((availableLiquidSavings / expenses) * 10) / 10 : 0,
    hasActiveInsurance: computeInsuranceCoverage(assets).hasActiveInsurance,
    // Honesty-audit fix (originally found and fixed in Mirror's own prompt -
    // lib/mirror-prompts.js): the baseline above silently falls back to the
    // client-typed currentSavings figure when the customer has never
    // itemized a real Asset Profile ledger entry. Every caller's prompt
    // must not unconditionally claim this number came from the ledger when
    // it might be this fallback - exposed here once so all 4 domain
    // prompt builders can phrase it honestly instead of each re-deriving
    // the same assets.length check.
    liquidSavingsSourcedFromLedger: assets.length > 0,
  };
}
