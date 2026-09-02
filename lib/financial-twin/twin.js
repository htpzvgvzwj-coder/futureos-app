// Financial Twin - the ONE canonical description of what the customer
// really owns, owes, earns and has promised (Future Bank round, sections
// 二 / 四 / 十).
//
// Every Studio, the Life Graph, Today's balance breakdown and the Current
// Ripple read their money facts from here. It does NOT invent figures:
// callers pass real rows (from the asset / liability / income / commitment
// stores) and this module composes them under one set of accounting rules,
// stamping every output with provenance + asOf.
//
// Rules enforced (section 十二 - Financial Twin tests):
//   - netWorth = Σ financial assets (ownership-adjusted) − Σ liabilities
//   - CPF SA/RA + MediSave never count as liquid or allocatable cash
//   - an asset earmarked `emergency` (protected) is not freely allocatable
//   - a joint / partner asset counts only at its ownershipPercent
//   - Life Capital (human/social/knowledge/...) never enters net worth
//   - a fresh customer with no rows gets zeros, never a persona
//
// Pure: no DB, no network, no Date.now (asOf is passed in).

import {
  isFinancialAssetClass,
  isLiabilityClass,
  isLifeCapitalClass,
  ALWAYS_RESTRICTED_CLASSES,
  SOURCE_TYPES,
} from "./classes.js";

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
// ownership share in [0,1]; missing -> assume wholly owned.
function share(row) {
  const p = row?.ownershipPercent;
  if (p == null) return 1;
  const n = Number(p);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}
// the portion of this asset the customer can actually draw on.
function availableOf(row) {
  const av = row?.availableValue;
  const base = av == null ? row?.currentValue : av;
  return money(base);
}

// "protected" = liquid cash the customer deliberately set aside for a
// safety goal. It is still liquid, but a Studio may not spend it.
function isProtected(row) {
  return row?.restrictedPurpose === "emergency" || row?.restrictedPurpose === "safety_buffer";
}
// "restricted" = cannot become spendable cash without a separate decision:
// a purpose-locked class (CPF SA/RA, MediSave), an illiquid/restricted
// liquidityClass, or an earmark to something other than a safety buffer.
function isRestricted(row) {
  if (ALWAYS_RESTRICTED_CLASSES.has(row?.assetClass)) return true;
  if (row?.liquidityClass === "restricted" || row?.liquidityClass === "illiquid") return true;
  if (row?.restrictedPurpose && row.restrictedPurpose !== "none" && !isProtected(row)) return true;
  return false;
}
// Liquid = becomes cash with no fresh decision and is not hard-restricted.
// A protected safety balance is still liquid (just not freely allocatable).
function isLiquid(row) {
  if (isRestricted(row)) return false;
  return row?.liquidityClass === "cash" || row?.liquidityClass === "near_cash" || row?.liquidityClass === "liquid";
}

// assets:      [{ assetClass, currentValue, availableValue?, liquidityClass, restrictedPurpose?, ownerType?, ownershipPercent?, currency?, sourceType, asOf, confidence?, isUserConfirmed? }]
// liabilities: [{ liabilityClass, currentBalance, minimumMonthly?, ownershipPercent?, currency?, sourceType, asOf }]
// income:      [{ monthlyAmount, kind?, sourceType }]        (net recurring inflow)
// commitments: [{ domain, monthlyContribution }]              (active sealed plans)
// lifeCapital: [{ capitalClass, note?, strengthRating? }]     (never valued)
export function buildFinancialTwin({
  assets = [],
  liabilities = [],
  income = [],
  monthlyExpenses = 0,
  commitments = [],
  lifeCapital = [],
  currency = "SGD",
  asOf = null,
} = {}) {
  const fin = assets.filter((a) => isFinancialAssetClass(a?.assetClass));
  const droppedAssets = assets.filter((a) => !isFinancialAssetClass(a?.assetClass));
  const lia = liabilities.filter((l) => isLiabilityClass(l?.liabilityClass));

  // --- financial asset totals (ownership-adjusted) -------------------
  let financialAssetsTotal = 0;
  let liquidAssets = 0;
  let restrictedAssets = 0;
  let protectedAssets = 0;
  let investedAssets = 0;
  const byClass = {};
  for (const a of fin) {
    const owned = money(a.currentValue) * share(a);
    const ownedAvail = availableOf(a) * share(a);
    financialAssetsTotal += owned;
    byClass[a.assetClass] = round2((byClass[a.assetClass] ?? 0) + owned);
    if (isLiquid(a)) liquidAssets += ownedAvail;
    if (isRestricted(a)) restrictedAssets += owned;
    if (isProtected(a)) protectedAssets += ownedAvail;
    if (a.assetClass === "investment") investedAssets += owned;
  }

  // --- liabilities (ownership-adjusted) ----------------------------
  let liabilitiesTotal = 0;
  let scheduledMonthlyDebt = 0;
  const liaByClass = {};
  for (const l of lia) {
    const owed = money(l.currentBalance) * share(l);
    liabilitiesTotal += owed;
    liaByClass[l.liabilityClass] = round2((liaByClass[l.liabilityClass] ?? 0) + owed);
    scheduledMonthlyDebt += money(l.minimumMonthly) * share(l);
  }

  const netWorth = financialAssetsTotal - liabilitiesTotal;

  // --- cashflow --------------------------------------------------
  const monthlyIncome = income.reduce((s, i) => s + money(i.monthlyAmount), 0);
  const committedMonthlyTotal = commitments.reduce((s, c) => s + money(c.monthlyContribution), 0);
  const monthlyFreeCashflow = monthlyIncome - money(monthlyExpenses) - scheduledMonthlyDebt - committedMonthlyTotal;

  // --- the balance breakdown (section 三.1) --------------------------
  // Available Now / Spoken For / Protected / Restricted / Invested.
  const spokenFor = Math.min(liquidAssets, committedMonthlyTotal); // near-term commitments already draw on liquid
  const availableNow = Math.max(0, liquidAssets - protectedAssets - spokenFor);
  const balanceBreakdown = {
    availableNow: round2(availableNow),
    spokenFor: round2(spokenFor),
    protectedFor: round2(protectedAssets),
    restricted: round2(restrictedAssets),
    invested: round2(investedAssets),
    total: round2(financialAssetsTotal),
  };

  // Cash a Studio may actually propose spending: liquid, minus protected,
  // minus what sealed plans already claim.
  const freelyAllocatableCash = round2(Math.max(0, liquidAssets - protectedAssets - spokenFor));

  // --- provenance summary --------------------------------------
  const sourceCounts = {};
  for (const s of SOURCE_TYPES) sourceCounts[s] = 0;
  for (const a of [...fin, ...lia]) if (a?.sourceType && a.sourceType in sourceCounts) sourceCounts[a.sourceType] += 1;
  const hasSyntheticFixture = sourceCounts.synthetic_fixture > 0;
  const anyAuthoritative = fin.some((a) => a?.isUserConfirmed) || sourceCounts.bank_synced + sourceCounts.government_linked + sourceCounts.insurer_linked > 0;

  return {
    currency,
    asOf,
    isEmpty: fin.length === 0 && lia.length === 0 && income.length === 0,

    netWorth: round2(netWorth),
    financialAssetsTotal: round2(financialAssetsTotal),
    liabilitiesTotal: round2(liabilitiesTotal),
    liquidAssets: round2(liquidAssets),
    restrictedAssets: round2(restrictedAssets),
    protectedAssets: round2(protectedAssets),
    investedAssets: round2(investedAssets),

    monthlyIncome: round2(monthlyIncome),
    monthlyExpenses: round2(money(monthlyExpenses)),
    scheduledMonthlyDebt: round2(scheduledMonthlyDebt),
    committedMonthlyTotal: round2(committedMonthlyTotal),
    monthlyFreeCashflow: round2(monthlyFreeCashflow),

    balanceBreakdown,
    freelyAllocatableCash,

    assetsByClass: byClass,
    liabilitiesByClass: liaByClass,

    // Life Capital is described, never valued in.
    lifeCapital: lifeCapital
      .filter((c) => isLifeCapitalClass(c?.capitalClass))
      .map((c) => ({ capitalClass: c.capitalClass, note: c.note ?? null, strengthRating: c.strengthRating ?? null })),
    lifeCapitalExcludedFromNetWorth: true,

    provenance: {
      sourceCounts,
      hasSyntheticFixture,
      anyAuthoritative,
      droppedNonFinancialAssetCount: droppedAssets.length,
    },
  };
}

// A convenience for the Life Graph / Studios: the single money context they
// must all share, derived from ONE twin so no two of them disagree.
export function twinToStudioContext(twin) {
  if (!twin) return null;
  return {
    monthlyIncome: twin.monthlyIncome,
    monthlyExpenses: twin.monthlyExpenses,
    committedMonthlyTotal: twin.committedMonthlyTotal,
    availableMonthlyCashflow: twin.monthlyFreeCashflow,
    freelyAllocatableCash: twin.freelyAllocatableCash,
    liquidAssets: twin.liquidAssets,
    asOf: twin.asOf,
  };
}
