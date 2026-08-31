// Capital Prism - the Investment Studio's flagship domain finance engine (pure).
//
// One beam of monthly capital enters the prism and splits into spectral
// bands, each a JOB for the money: Safety, Wedding, Home, Flexible,
// Retirement, Long-term Capital. The customer drags the seams between
// bands to move capital from one job to the next; a Liquidity Gate sets
// how long the money must stay reachable, so near-term and long-term jobs
// visibly pull against each other. NO investment return is assumed in the
// base - only the contributed amount. No trade is ever executed here.

import { computeInvestmentReadiness } from "../investment-readiness-finance.js";
import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value), provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}

// The six bands, in spectrum order. `liquid` bands stay reachable; the two
// locked bands are the actual "investing" commitment.
export const PRISM_BANDS = [
  { id: "safety", liquid: true, horizonYears: 0 },
  { id: "wedding", liquid: true, horizonYears: 1 },
  { id: "home", liquid: true, horizonYears: 3 },
  { id: "flexible", liquid: true, horizonYears: 0 },
  { id: "retirement", liquid: false, horizonYears: 20 },
  { id: "longTerm", liquid: false, horizonYears: 10 },
];
const LIQUID_IDS = PRISM_BANDS.filter((b) => b.liquid).map((b) => b.id);
const LOCKED_IDS = PRISM_BANDS.filter((b) => !b.liquid).map((b) => b.id);

function poolFrom(planData, context) {
  const cash = num(context.availableMonthlyCashflow ?? planData.available_monthly_cashflow);
  if (cash > 0) return { value: Math.round(cash / 10) * 10, known: true, provenance: "bank_confirmed" };
  const inc = num(context.monthlyIncome ?? planData.monthly_income);
  const exp = num(context.monthlyExpenses ?? planData.monthly_expenses);
  if (inc > 0 && exp > 0) return { value: Math.max(0, Math.round((inc - exp) / 10) * 10), known: false, provenance: "system_estimate" };
  return { value: 0, known: false, provenance: "unknown" };
}

function defaultJobs(pool, commitment) {
  const locked = Math.max(0, Math.min(pool, commitment));
  return { safety: 0, wedding: 0, home: 0, flexible: Math.max(0, pool - locked), retirement: 0, longTerm: locked };
}

// planData: {
//   jobs? (the split object), monthly_commitment?, liquidity_gate_years?,
//   horizon_years?, target_pool?, current_savings?, credit_card_outstanding?,
//   monthly_income?, monthly_expenses?, real_return_assumption?
// }
// context: { availableMonthlyCashflow?, monthlyIncome?, monthlyExpenses?,
//   emergencyBufferMonths?, now? }
export function computeCapitalPrism({ planData = {}, context = {} }) {
  const now = context.now ?? new Date();
  const pool = poolFrom(planData, context);

  const commitment = num(planData.monthly_commitment);
  const jobs = planData.jobs && typeof planData.jobs === "object"
    ? { safety: 0, wedding: 0, home: 0, flexible: 0, retirement: 0, longTerm: 0, ...Object.fromEntries(Object.entries(planData.jobs).map(([k, v]) => [k, Math.max(0, num(v))])) }
    : defaultJobs(pool.value, commitment);

  const assigned = PRISM_BANDS.reduce((sum, b) => sum + num(jobs[b.id]), 0);
  const unassigned = Math.round(pool.value - assigned);
  // You cannot be "over" a pool you do not know.
  const over = pool.known && assigned > pool.value + 0.5;
  const liquidKept = LIQUID_IDS.reduce((sum, id) => sum + num(jobs[id]), 0);
  const investingCommitment = LOCKED_IDS.reduce((sum, id) => sum + num(jobs[id]), 0);
  const gateYears = num(planData.liquidity_gate_years, 3);

  const savingsKnown = planData.current_savings != null;
  const currentSavings = num(planData.current_savings);
  const ccKnown = planData.credit_card_outstanding != null;
  const readiness = computeInvestmentReadiness({
    currentSavings,
    monthlyExpenses: num(context.monthlyExpenses ?? planData.monthly_expenses),
    creditCardOutstanding: num(planData.credit_card_outstanding),
    availableMonthlyCashflow: pool.value,
  });
  const readyToInvest = readiness.readiness === "readyToInvest";

  const horizonYears = num(planData.horizon_years, 10);
  const targetPool = num(planData.target_pool) > 0
    ? num(planData.target_pool)
    : Math.round(horizonYears * 12 * (commitment > 0 ? commitment : investingCommitment));
  const shortfall = Math.max(0, targetPool - currentSavings);
  const monthsToTarget = investingCommitment > 0 ? Math.ceil(shortfall / investingCommitment) : null;
  const yearsToTarget = monthsToTarget != null ? Math.round((monthsToTarget / 12) * 10) / 10 : null;

  // Optional labelled optimistic band - ONLY with a stated assumption.
  const rr = planData.real_return_assumption != null ? num(planData.real_return_assumption) / 100 : null;
  let optimistic = null;
  if (rr != null && rr > 0 && investingCommitment > 0 && shortfall > 0) {
    const r = rr / 12;
    const n = Math.log(1 + (shortfall * r) / investingCommitment) / Math.log(1 + r);
    optimistic = {
      assumptionPercent: num(planData.real_return_assumption),
      years: Math.round((n / 12) * 10) / 10,
      note: `Assumes a ${planData.real_return_assumption}% real return every year - an assumption, never a guarantee`,
    };
  }

  const openHorizonBand = pool.value > 0 ? Math.min(1, Math.round((assigned / pool.value) * 100) / 100) : 1;
  const flexibleAndUnassigned = num(jobs.flexible) + Math.max(0, unassigned);
  // Capital reachable within the customer's chosen Liquidity Gate.
  const reachableWithinGate = Math.round(PRISM_BANDS.filter((b) => b.horizonYears <= gateYears).reduce((s, b) => s + num(jobs[b.id]), 0));

  const liquidityConflict = over;
  // The real gate: you cannot LOCK money into long-term investing while the
  // readiness gate says build a buffer / pay down high-cost debt first.
  const investingBlockedByGate = investingCommitment > 0 && !readyToInvest;

  const sealable = !over && pool.known && (readyToInvest || investingCommitment === 0);
  const sealableReason = over ? "capital_over_allocated"
    : !pool.known ? "capital_pool_unknown"
    : investingBlockedByGate ? readiness.readiness
    : "ok";

  return {
    available: true,
    bands: PRISM_BANDS,
    pool: fig(pool.value, pool.provenance),
    poolKnown: pool.known,
    jobs,
    assigned: Math.round(assigned),
    unassigned,
    over,
    liquidKept: fig(liquidKept, "system_estimate"),
    investingCommitment: fig(investingCommitment, planData.jobs || planData.monthly_commitment != null ? "user_confirmed" : "system_estimate"),
    flexibleAndUnassigned: fig(flexibleAndUnassigned, "system_estimate"),
    gateYears,
    reachableWithinGate: fig(reachableWithinGate, "system_estimate"),
    readiness: readiness.readiness,
    emergencyFundMonths: readiness.emergencyFundMonths,
    hasEmergencyBuffer: readiness.hasEmergencyBuffer,
    readyToInvest,
    investingBlockedByGate,
    targetPool,
    currentSavings: fig(currentSavings, savingsKnown ? "user_confirmed" : "unknown"),
    monthsToTarget,
    yearsToTarget,
    optimistic,
    openHorizonBand,
    liquidityConflict,
    sealable,
    sealableReason,
    assumptions: [
      { text: "No investment return is assumed - this is the contributed amount only", confidence: "high", asOf: now.toISOString().slice(0, 7) },
      { text: "The Liquidity Gate is your rule for how long money must stay reachable - not a market call", confidence: "high" },
      readyToInvest ? null : { text: `Readiness gate: ${readiness.readiness} - locked investing bands are not sealable yet`, confidence: "high" },
      rr != null ? { text: "The optimistic band uses a stated real-return assumption, shown separately from the base", confidence: "medium" } : null,
    ].filter(Boolean),
    unknowns: [
      pool.known ? null : "available_monthly_cashflow",
      savingsKnown ? null : "current_savings",
      ccKnown ? null : "credit_card_outstanding",
    ].filter(Boolean),
  };
}

// Back-solve: the monthly investing amount needed to reach the target pool
// in a chosen number of years (NO return assumed).
export function requiredInvestingForTargetYears({ prism, byYears }) {
  if (!prism?.available || !(byYears > 0)) return null;
  const shortfall = Math.max(0, prism.targetPool - num(prism.currentSavings?.value));
  return Math.ceil(shortfall / (byYears * 12));
}
