// Cross-domain read layer that fixes double-counting of currentSavings:
// every domain (wedding/home/retirement/loan/emergency/other) used to treat
// the full currentSavings figure as independently available, unaware that a
// confirmed lump-sum investment purchase already drew part of it down.
// Mirrors the parallel-store-reads-no-SQL-join pattern established by
// lib/loan-context.js / lib/investment-context.js / lib/hardship-context.js.

import { listAssets } from "./asset-store.js";
import { computeLiquidAssets } from "./asset-finance.js";
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
// the client-sent figure entirely and uses computeLiquidAssets() against the
// real ledger (lib/asset-finance.js) - same reasoning every confirm route
// already applies to otherGoalsMonthlyOutflow ("a stale or failed client
// fetch here can never corrupt what gets persisted"). Falls back to the
// client-sent value verbatim when no assets exist yet - zero regression for
// a customer who hasn't touched the Asset Profile ledger, matching
// manualEntryProvider's override philosophy in app/page.jsx.
export async function resolveAvailableLiquidSavings(profileKey, clientSentCurrentSavings) {
  const assets = await listAssets(profileKey);
  const baseline = assets.length > 0 ? computeLiquidAssets(assets) : numberValue(clientSentCurrentSavings, 0);
  const lumpCommitted = await getConfirmedInvestmentLumpSumTotal(profileKey);
  return Math.max(0, baseline - lumpCommitted);
}
