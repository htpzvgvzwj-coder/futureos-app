// Deterministic engine for the Investment Planner. Mirrors the discipline
// established by lib/loan-finance.js: the AI only ever narrates a shortlist
// this module has already built and already priced — every dollar figure,
// score, and ranking here is computed by code, never invented by a model.
// See lib/investment-catalog.js's header comment for why this domain is
// held to an even stricter "AI touches zero numbers" bar than loan/wedding/
// home/retirement.

import { INVESTMENT_CATALOG, RISK_BANDS } from "./investment-catalog.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Purchase-mode projections
// ---------------------------------------------------------------------------

function projectMonthlyRsp({ monthlyContribution, annualReturnPercent, horizonYears }) {
  const i = annualReturnPercent / 100 / 12;
  const n = Math.round(horizonYears * 12);
  const totalContributed = monthlyContribution * n;
  const projectedEndValue = i === 0 ? totalContributed : monthlyContribution * (((1 + i) ** n - 1) / i);
  return {
    totalContributed: round2(totalContributed),
    projectedEndValue: round2(projectedEndValue),
    projectedGrowth: round2(projectedEndValue - totalContributed),
  };
}

function projectLumpSum({ lumpSumAmount, annualReturnPercent, horizonYears }) {
  const i = annualReturnPercent / 100 / 12;
  const n = Math.round(horizonYears * 12);
  const projectedEndValue = lumpSumAmount * (1 + i) ** n;
  return {
    totalContributed: round2(lumpSumAmount),
    projectedEndValue: round2(projectedEndValue),
    projectedGrowth: round2(projectedEndValue - lumpSumAmount),
  };
}

// Daily rate is derived from the annual return via compounding (not a naive
// r/252), so it stays internally consistent with the monthly-compounding
// modes above rather than silently assuming a different compounding
// convention for this one mode.
function projectDailyMicroDca({ dailyAmount, annualReturnPercent, horizonYears }) {
  const r = annualReturnPercent / 100;
  const dailyRate = (1 + r) ** (1 / 252) - 1;
  const totalDays = Math.round(horizonYears * 252);
  const totalContributed = dailyAmount * totalDays;
  const projectedEndValue =
    dailyRate === 0 ? totalContributed : dailyAmount * (((1 + dailyRate) ** totalDays - 1) / dailyRate);
  return {
    totalContributed: round2(totalContributed),
    projectedEndValue: round2(projectedEndValue),
    projectedGrowth: round2(projectedEndValue - totalContributed),
    // ~21 trading days/month — lets the UI/cashflow scoring compare this
    // mode against the other three on a common monthly basis.
    monthlyEquivalentAmount: round2(dailyAmount * 21),
  };
}

// Value averaging under this app's zero-volatility, fixed-expected-return
// assumption (see lib/investment-catalog.js's header comment — this
// codebase never simulates market volatility). Two conventions exist in the
// literature:
//   - Compounding-target (Edleson's original): Target(t) = Target(t-1)*(1+i)
//     + baseContribution. Under a CONSTANT assumed return with no
//     volatility, this degenerates to an exactly flat contribution every
//     period — mathematically identical to monthly RSP, nothing new to show
//     a customer.
//   - Straight-line target path (used here): Target(t) = G*t/N, a linear
//     path to the same end goal G. Even with zero volatility this produces
//     a genuinely different, front-loaded/tapering contribution shape —
//     real information for a customer's liquidity planning — even though it
//     does NOT capture value averaging's real-world "buy more when it dips"
//     edge, which requires actual price volatility to exist. The locale
//     copy carries an explicit disclaimer about this (see
//     investmentPlanner.valueAveragingDisclaimer).
// G is the future value a flat monthly RSP at `baselineMonthlyAmount` would
// reach over the same horizon (i.e. value averaging targets the same end
// goal as the equivalent flat-DCA baseline, just on a different schedule).
function projectValueAveraging({ baselineMonthlyAmount, annualReturnPercent, horizonYears }) {
  const i = annualReturnPercent / 100 / 12;
  const n = Math.round(horizonYears * 12);
  const goal = i === 0 ? baselineMonthlyAmount * n : baselineMonthlyAmount * (((1 + i) ** n - 1) / i);

  const schedule = [];
  let balance = 0;
  let totalContributed = 0;
  let flooredMonths = 0;

  for (let t = 1; t <= n; t += 1) {
    const target = (goal * t) / n;
    const raw = target - balance * (1 + i);
    const contribution = Math.max(0, raw);
    if (raw < 0) flooredMonths += 1;
    balance = balance * (1 + i) + contribution;
    totalContributed += contribution;
    schedule.push({ month: t, contribution: round2(contribution) });
  }

  return {
    schedule,
    totalContributed: round2(totalContributed),
    projectedEndValue: round2(balance),
    projectedGrowth: round2(balance - totalContributed),
    flooredMonths,
    shortfallWarning: flooredMonths > 0,
  };
}

// Single dispatch point for all 4 modes — used both server-side (routes)
// and client-side (for instant live-preview numbers before confirming,
// mirroring how LoanPlannerContent imports computeAllLoanArchetypes
// directly for the same purpose).
export function projectPurchaseMode({ mode, entry, amount, horizonYears }) {
  const annualReturnPercent = entry.expectedAnnualReturnPercent;
  switch (mode) {
    case "monthly_rsp":
      return { mode, ...projectMonthlyRsp({ monthlyContribution: amount, annualReturnPercent, horizonYears }) };
    case "lump_sum":
      return { mode, ...projectLumpSum({ lumpSumAmount: amount, annualReturnPercent, horizonYears }) };
    case "daily_micro_dca":
      return { mode, ...projectDailyMicroDca({ dailyAmount: amount, annualReturnPercent, horizonYears }) };
    case "value_averaging":
      return { mode, ...projectValueAveraging({ baselineMonthlyAmount: amount, annualReturnPercent, horizonYears }) };
    default:
      throw new Error(`Unknown purchase mode: ${mode}`);
  }
}

// Reduces a mode + confirmed amount + its projection down to the two inputs
// computeInvestmentFutureScore needs (a recurring monthly draw on cashflow,
// or a one-off draw on savings) — kept here, not duplicated in the confirm
// route, so all mode-specific branching lives in one place.
export function deriveCommitmentForFutureScore(mode, amount, projection) {
  switch (mode) {
    case "monthly_rsp":
      return { monthlyCommitment: amount, lumpSumUsed: 0 };
    case "value_averaging":
      return { monthlyCommitment: projection.schedule?.[0]?.contribution ?? amount, lumpSumUsed: 0 };
    case "daily_micro_dca":
      return { monthlyCommitment: projection.monthlyEquivalentAmount ?? amount * 21, lumpSumUsed: 0 };
    case "lump_sum":
      return { monthlyCommitment: 0, lumpSumUsed: amount };
    default:
      return { monthlyCommitment: 0, lumpSumUsed: 0 };
  }
}

// ---------------------------------------------------------------------------
// Shortlist / scoring
// ---------------------------------------------------------------------------

function computeMonthlyEquivalentMinimum(entry, purchaseMode) {
  const min = entry.minInitialInvestmentByMode[purchaseMode];
  if (min == null) return null;
  return purchaseMode === "daily_micro_dca" ? min * 21 : min;
}

// Weighted composite: risk fit 40% + diversification 25% + affordability
// 20% + horizon fit 15%. Every component is independently inspectable, same
// "no unexplained numbers" discipline as loan-finance.js's Future Score.
export function scoreInvestmentCandidate(entry, context) {
  const { riskBand, holdingsCategories, availableMonthlyCashflow, horizonYears, purchaseMode } = context;

  const riskDistance = Math.abs(RISK_BANDS.indexOf(entry.riskBand) - RISK_BANDS.indexOf(riskBand));
  const riskFitScore = riskDistance === 0 ? 100 : riskDistance === 1 ? 60 : 20;

  const diversificationScore = holdingsCategories.includes(entry.category) ? 40 : 100;

  // Lump sum draws from savings, not monthly cashflow — this scorer only
  // sees monthly headroom, so a lump-sum pick scores as fully affordable
  // here; its real affordability against currentSavings is judged
  // separately at confirm time via computeInvestmentFutureScore's
  // emergency-buffer component.
  let affordabilityScore = 100;
  if (purchaseMode !== "lump_sum") {
    const monthlyEquivalentMinimum = computeMonthlyEquivalentMinimum(entry, purchaseMode);
    const ratio = availableMonthlyCashflow > 0 ? monthlyEquivalentMinimum / availableMonthlyCashflow : Infinity;
    affordabilityScore = ratio <= 0.5 ? 100 : ratio <= 1 ? 60 : 0;
  }

  const horizonFitScore =
    horizonYears >= entry.suggestedMinHorizonYears
      ? 100
      : clamp((100 * horizonYears) / entry.suggestedMinHorizonYears, 0, 100);

  const suitabilityScore = Math.round(
    riskFitScore * 0.4 + diversificationScore * 0.25 + affordabilityScore * 0.2 + horizonFitScore * 0.15,
  );

  return {
    entry_id: entry.id,
    suitability_score: suitabilityScore,
    risk_fit_score: riskFitScore,
    diversification_score: diversificationScore,
    affordability_score: affordabilityScore,
    horizon_fit_score: horizonFitScore,
  };
}

// Filters the catalog by market/mode-support/affordability, scores what's
// left, sorts by suitability, and guarantees at least one SG + one global
// result survives into the top `maxResults` when both markets have
// qualifying candidates (so the shortlist reflects the SG+global scope the
// customer asked for even when one market scores slightly better overall).
export function shortlistInvestments({
  riskBand,
  markets,
  holdingsCategories,
  availableMonthlyCashflow,
  horizonYears,
  purchaseMode,
  maxResults = 6,
}) {
  const eligible = INVESTMENT_CATALOG.filter((entry) => {
    if (!markets.includes(entry.market)) return false;
    if (!entry.supportedPurchaseModes.includes(purchaseMode)) return false;
    if (purchaseMode !== "lump_sum") {
      const monthlyEquivalentMinimum = computeMonthlyEquivalentMinimum(entry, purchaseMode);
      if (monthlyEquivalentMinimum > availableMonthlyCashflow) return false;
    }
    return true;
  });

  const scored = eligible
    .map((entry) => ({
      entry,
      score: scoreInvestmentCandidate(entry, { riskBand, holdingsCategories, availableMonthlyCashflow, horizonYears, purchaseMode }),
    }))
    .sort((a, b) => b.score.suitability_score - a.score.suitability_score);

  const sgTop = scored.find((item) => item.entry.market === "sg");
  const globalTop = scored.find((item) => item.entry.market === "global");
  const guaranteed = [sgTop, globalTop].filter(Boolean);
  const guaranteedIds = new Set(guaranteed.map((item) => item.entry.id));
  const rest = scored.filter((item) => !guaranteedIds.has(item.entry.id));

  return [...guaranteed, ...rest].slice(0, maxResults).map(({ entry, score }) => ({
    entry_id: entry.id,
    name: entry.name,
    ticker: entry.ticker,
    instrument_type: entry.instrumentType,
    market: entry.market,
    category: entry.category,
    risk_band: entry.riskBand,
    expected_annual_return_percent: entry.expectedAnnualReturnPercent,
    expense_ratio_percent: entry.expenseRatioPercent,
    dividend_yield_percent: entry.dividendYieldPercent,
    suggested_min_horizon_years: entry.suggestedMinHorizonYears,
    description_key: entry.descriptionKey,
    disclosure_key: entry.disclosureKey,
    ...score,
  }));
}

// ---------------------------------------------------------------------------
// Future Score (portfolio-level, analogous to loan-finance.js's per-strategy
// Future Score)
// ---------------------------------------------------------------------------

function emergencyFundImpactLabel(monthsCovered) {
  if (monthsCovered >= 6) return "protected";
  if (monthsCovered >= 3) return "healthy";
  if (monthsCovered >= 1) return "reduced";
  return "weak";
}

function cashflowImpactLabel(residualIncome, monthlyIncome) {
  if (residualIncome >= monthlyIncome * 0.1) return "on_track";
  if (residualIncome >= 0) return "tight";
  return "at_risk";
}

// residual income 35% + emergency-buffer-after 25% + diversification 20% +
// horizon fit 20%. Replaces loan's pure-repayment "stress" component (there
// is no serviceability-cap concept for a voluntary contribution) with the
// diversification/horizon-fit components already computed by
// scoreInvestmentCandidate for this pick.
export function computeInvestmentFutureScore({
  monthlyCommitment,
  lumpSumUsed = 0,
  monthlyIncome,
  monthlyExpenses,
  currentSavings,
  otherGoalsMonthlyOutflow,
  diversificationScore,
  horizonFitScore,
}) {
  const residualIncome = monthlyIncome - monthlyExpenses - otherGoalsMonthlyOutflow - monthlyCommitment;
  const residualScore = clamp((residualIncome / (monthlyIncome * 0.2)) * 100, 0, 100);

  const postCommitmentSavings = Math.max(0, currentSavings - lumpSumUsed);
  const emergencyFundMonthsCoveredAfter = monthlyExpenses > 0 ? postCommitmentSavings / monthlyExpenses : 0;
  const bufferScore = clamp((emergencyFundMonthsCoveredAfter / 6) * 100, 0, 100);

  const futureScore = Math.round(
    residualScore * 0.35 + bufferScore * 0.25 + diversificationScore * 0.2 + horizonFitScore * 0.2,
  );

  return {
    future_score: futureScore,
    emergency_fund_months_covered_after: Math.round(emergencyFundMonthsCoveredAfter * 10) / 10,
    emergency_fund_impact: emergencyFundImpactLabel(emergencyFundMonthsCoveredAfter),
    residual_income_monthly: Math.round(residualIncome),
    cashflow_impact: cashflowImpactLabel(residualIncome, monthlyIncome),
  };
}
