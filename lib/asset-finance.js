// Deterministic engine for the Asset Profile (资产台账). Same "AI touches
// zero numbers" discipline as every other *-finance.js module in this
// codebase (see strategic-balance-finance.js) — this module is pure
// arithmetic over real itemized asset rows (lib/asset-store.js) and real
// profile inputs; nothing here is invented or AI-sourced.

import { ASSET_CATEGORIES, STAGES, getStageForAsset } from "./asset-taxonomy.js";

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Only categories 1-3 (financial/physical/business) are treated as "core"
// monetized net worth by default — categories 4-8 only contribute if the
// customer explicitly gave that specific item a value (most of their items
// won't have one, by design; see NON_MONETARY_CATEGORIES).
export function computeNetWorth(assets, { existingLoans = 0, creditCardOutstanding = 0 } = {}) {
  const assetTotal = (assets ?? []).reduce((sum, asset) => sum + numberOrZero(asset.value), 0);
  const liabilities = numberOrZero(existingLoans) + numberOrZero(creditCardOutstanding);
  return {
    assetTotal: Math.round(assetTotal),
    liabilities: Math.round(liabilities),
    netWorth: Math.round(assetTotal - liabilities),
  };
}

// Liquid = financial assets whose liquidity is cash or near_cash — the real
// input the Life Graph "savings strength" / emergency-fund math needs,
// replacing the old flat `currentSavings` number.
export function computeLiquidAssets(assets) {
  return Math.round(
    (assets ?? [])
      .filter((asset) => asset.category === "financial" && ["cash", "near_cash"].includes(asset.details?.liquidity))
      .reduce((sum, asset) => sum + numberOrZero(asset.value), 0)
  );
}

// Liquidity-tiered "available savings" pool, keyed by how urgently a goal
// needs the money: "tight" (cash + near_cash only) for near-term/urgent
// needs where forcing a sale of a market-exposed asset right before the
// money is needed would be a bad idea (emergency fund, a wedding a few
// months out); "flexible" (+ liquid) for goals with enough runway to plan
// a sale (a home down payment saved over years, retirement, a voluntary
// investment). `illiquid` financial assets are never included — a
// financial illiquid holding (rare, but the field allows it) can't fund
// any goal without a separate decision, at any horizon. Never counts
// physical/business/other categories - only lib/asset-taxonomy.js's
// `financial` category has a liquidity field at all.
const LIQUIDITY_TIERS_BY_HORIZON = {
  tight: ["cash", "near_cash"],
  flexible: ["cash", "near_cash", "liquid"],
};

export function computeAvailableSavings(assets, horizon = "flexible") {
  const allowedTiers = LIQUIDITY_TIERS_BY_HORIZON[horizon] ?? LIQUIDITY_TIERS_BY_HORIZON.flexible;
  return Math.round(
    (assets ?? [])
      .filter((asset) => asset.category === "financial" && allowedTiers.includes(asset.details?.liquidity))
      .reduce((sum, asset) => sum + numberOrZero(asset.value), 0)
  );
}

// Financial assets held for growth (fund/stock/bond/pension/crypto) — the
// real input replacing the old flat `investments` number.
const GROWTH_FINANCIAL_SUBTYPES = ["fund", "stock", "bond", "pension", "crypto"];
export function computeInvestmentAssets(assets) {
  return Math.round(
    (assets ?? [])
      .filter((asset) => asset.category === "financial" && GROWTH_FINANCIAL_SUBTYPES.includes(asset.subtype))
      .reduce((sum, asset) => sum + numberOrZero(asset.value), 0)
  );
}

// Real insurance signal — an active legal.insurance_policy row with a
// coverage amount, replacing the old regex match on a free-text
// `insuranceStatus` string.
export function computeInsuranceCoverage(assets) {
  const policies = (assets ?? []).filter(
    (asset) => asset.category === "legal" && asset.subtype === "insurance_policy" && asset.details?.status === "active"
  );
  const coverageAmount = policies.reduce((sum, asset) => sum + numberOrZero(asset.details?.coverageAmount), 0);
  return { hasActiveInsurance: policies.length > 0, coverageAmount: Math.round(coverageAmount) };
}

// Per-category totals ($ where present, item count always) for the 8-category
// breakdown view.
export function computeCategoryTotals(assets) {
  const byCategory = Object.fromEntries(ASSET_CATEGORIES.map((category) => [category, { itemCount: 0, valueTotal: 0 }]));
  for (const asset of assets ?? []) {
    const bucket = byCategory[asset.category];
    if (!bucket) continue;
    bucket.itemCount += 1;
    bucket.valueTotal += numberOrZero(asset.value);
  }
  for (const category of ASSET_CATEGORIES) byCategory[category].valueTotal = Math.round(byCategory[category].valueTotal);
  return byCategory;
}

// Per-stage rollup for the user's own 保命/增长/放大/传承 framework — $ total
// (where items have a value) + item count (since stages amplify/inherit are
// mostly non-monetary and a $0 total there shouldn't read as "empty").
export function computeStageRollup(assets) {
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, { itemCount: 0, valueTotal: 0, avgStrengthRating: null }]));
  const strengthSums = Object.fromEntries(STAGES.map((stage) => [stage, { sum: 0, count: 0 }]));

  for (const asset of assets ?? []) {
    const stage = getStageForAsset(asset.category, asset.subtype);
    const bucket = byStage[stage];
    if (!bucket) continue;
    bucket.itemCount += 1;
    bucket.valueTotal += numberOrZero(asset.value);
    if (asset.strengthRating != null) {
      strengthSums[stage].sum += numberOrZero(asset.strengthRating);
      strengthSums[stage].count += 1;
    }
  }

  for (const stage of STAGES) {
    byStage[stage].valueTotal = Math.round(byStage[stage].valueTotal);
    const { sum, count } = strengthSums[stage];
    byStage[stage].avgStrengthRating = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  }
  return byStage;
}

// Replacement inputs for app/page.jsx's getHealthScores(): real computed
// sums from the itemized ledger instead of the 4 isolated flat profile
// fields. Callers should fall back to the old flat-field math when
// `assets` is empty (brand-new / not-yet-migrated profile) — this function
// itself makes no such decision, it just computes what the real numbers are
// when assets DO exist.
export function computeAssetHealthInputs(assets) {
  const { hasActiveInsurance, coverageAmount } = computeInsuranceCoverage(assets);
  return {
    savings: computeLiquidAssets(assets),
    investments: computeInvestmentAssets(assets),
    hasActiveInsurance,
    insuranceCoverage: coverageAmount,
  };
}
