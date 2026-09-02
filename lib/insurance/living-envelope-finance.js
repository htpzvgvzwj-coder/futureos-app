// Living Envelope - the Insurance Studio's flagship domain finance engine (pure).
//
// A closed protection membrane around the customer's real life nodes:
// Income, Home loan, Family, Care. Each node sits at a radius = its
// protection NEED; the membrane's radius at that node = the coverage the
// customer has TOLD us about. Where coverage < need the membrane dips
// INSIDE the node - visible exposure. An Unknown node is never drawn as a
// gap and never counted. Sealing here commits to a monthly PREMIUM change
// only - it never buys a policy, runs underwriting, or produces a quote.

import { computeProtectionEnvelope } from "./protection-finance.js";
import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value), provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}

// ~SGD 0.35 / year per SGD 1,000 of term cover, expressed monthly.
const PREMIUM_PER_1000_PER_MONTH = 0.35 / 12;
export function premiumForCover(amount) {
  return Math.round((Math.max(0, num(amount)) / 1000) * PREMIUM_PER_1000_PER_MONTH * 100) / 100;
}

// The four life nodes, in membrane order (angles for the scene).
export const PROTECTION_NODES = [
  { id: "income", angle: -90 },
  { id: "home_loan", angle: 0 },
  { id: "family", angle: 90 },
  { id: "care", angle: 180 },
];
const COVER_KEY = { income: "existing_income_protection", home_loan: "existing_life_cover", family: "existing_life_cover", care: "existing_ci_cover" };

// planData: everything computeProtectionEnvelope reads, plus:
//   desired_cover? { income, home_loan, family, care }  (the stretched membrane)
//   minimum_current_breathing_room?, minimum_income_protection_months?
// context: { monthlyIncome, monthlyExpenses, otherGoalsMonthlyOutflow, now }
export function computeLivingEnvelope({ planData = {}, context = {} }) {
  const now = context.now ?? new Date();
  const desired = planData.desired_cover && typeof planData.desired_cover === "object" ? planData.desired_cover : {};

  // Apply the stretched membrane as extra declared cover before the base
  // envelope math runs, so need/have/gap stay one source of truth.
  const withDesired = { ...planData };
  for (const n of PROTECTION_NODES) {
    const d = num(desired[n.id]);
    if (d > 0) {
      const key = COVER_KEY[n.id];
      withDesired[key] = Math.max(num(withDesired[key]), d);
    }
  }
  const base = computeProtectionEnvelope({ planData: planData });
  const stretched = computeProtectionEnvelope({ planData: withDesired });

  const membrane = PROTECTION_NODES.map((pn) => {
    const bn = base.nodes.find((x) => x.id === pn.id) ?? { need: 0, have: 0, status: "unknown", gapAmount: null };
    const sn = stretched.nodes.find((x) => x.id === pn.id) ?? bn;
    const need = num(sn.need);
    const have = num(sn.have);
    const coverRatio = need > 0 ? Math.min(1.25, Math.round((have / need) * 100) / 100) : sn.status === "unknown" ? null : 1;
    const state = sn.status === "unknown" ? "unknown" : sn.status === "partial" ? "partial" : (sn.gapAmount ?? 0) > 0 ? "gap" : "covered";
    return {
      id: pn.id,
      angle: pn.angle,
      need,
      have,
      coverRatio,
      state,
      exposureAmount: sn.status === "known" ? Math.max(0, need - have) : null,
      stretchedFrom: num(bn.have),
      premiumToClose: sn.status === "known" ? premiumForCover(Math.max(0, need - have)) : null,
    };
  });

  const knownExposure = membrane.reduce((s, m) => s + (m.exposureAmount ?? 0), 0);
  const unknownNodes = membrane.filter((m) => m.state === "unknown").map((m) => m.id);

  // The monthly premium is the pressure. If the customer stretched the
  // membrane, the implied extra premium rides on top of what they pay now.
  const premiumNow = num(planData.monthly_premium_now);
  const impliedExtra = membrane.reduce((s, m) => {
    const added = Math.max(0, num(m.have) - num(m.stretchedFrom));
    return s + premiumForCover(added);
  }, 0);
  const premiumAfter = planData.monthly_premium_now != null && Object.keys(desired).length === 0
    ? premiumNow
    : Math.round((premiumNow + impliedExtra) * 100) / 100;

  const income = num(context.monthlyIncome ?? planData.monthly_income);
  const currentBreathingRoomAfter = income > 0
    ? Math.round(income - num(context.monthlyExpenses ?? planData.monthly_expenses) - num(context.otherGoalsMonthlyOutflow) - premiumAfter)
    : null;
  const liquidityConflict = currentBreathingRoomAfter != null && currentBreathingRoomAfter < 0;
  const minBreathing = num(planData.minimum_current_breathing_room, 0);
  const belowBreathing = currentBreathingRoomAfter != null && currentBreathingRoomAfter < minBreathing;

  const incomeMonths = num(planData.income_protection_months, 12);
  const minIncomeMonths = num(planData.minimum_income_protection_months, 0);
  const belowIncomeFloor = minIncomeMonths > 0 && incomeMonths < minIncomeMonths;

  const sealable = !liquidityConflict && !belowBreathing && !belowIncomeFloor;
  const sealableReason = liquidityConflict ? "premium_exceeds_cashflow"
    : belowBreathing ? "below_current_breathing_room"
    : belowIncomeFloor ? "below_income_protection_floor"
    : "ok";

  return {
    available: true,
    membrane,
    knownExposure: Math.round(knownExposure),
    unknownNodes,
    unknownCount: unknownNodes.length,
    envelopeStatus: unknownNodes.length > 0 ? "has_unknowns" : knownExposure > 0 ? "exposure_identified" : "sealed_shut",
    premiumNow: fig(premiumNow, planData.monthly_premium_now != null ? "user_confirmed" : "system_estimate"),
    premiumAfter: fig(premiumAfter, "system_estimate"),
    premiumToCloseKnownGaps: Math.round(membrane.reduce((s, m) => s + (m.premiumToClose ?? 0), 0) * 100) / 100,
    incomeProtectionMonths: incomeMonths,
    currentBreathingRoomAfter: fig(currentBreathingRoomAfter, income > 0 ? "system_estimate" : "unknown"),
    liquidityConflict,
    belowBreathing,
    belowIncomeFloor,
    sealable,
    sealableReason,
    assumptions: [
      { text: "Gaps use YOUR stated coverage - an Unknown node is shown as unknown, never counted as a gap", confidence: "high", asOf: now.toISOString().slice(0, 7) },
      { text: "Premium figures are a reference estimate - not a quote, no underwriting", confidence: "low" },
      { text: "Sealing commits to a monthly premium change only - it does not buy a policy", confidence: "high" },
    ],
    unknowns: unknownNodes.map((id) => `${id}_cover_or_need`),
  };
}

// Back-solve: the monthly premium implied by stretching one node's cover
// from `fromHave` to `toHave` (reference rate, never a quote).
export function requiredPremiumForCover({ fromHave, toHave }) {
  return premiumForCover(Math.max(0, num(toHave) - num(fromHave)));
}
