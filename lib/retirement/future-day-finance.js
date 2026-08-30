// Future-Day Loom - the Retirement Studio's domain finance engine (pure).
//
// It does NOT open with a retirement number. It opens with a Future Day the
// customer builds one question at a time; the number is worked BACKWARDS
// from that day. Every output is a RANGE, never a single "you need X".
// No investment return is assumed in the base projection; an optimistic
// band is shown only with a stated, dated assumption. CPF / partner assets
// / inheritance are counted only when confirmed.

import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value), provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}

// One question at a time. Each option carries a TRANSPARENT monthly delta
// to a baseline "future monthly life" figure - shown to the customer, not
// hidden inside a score.
export const FUTURE_DAY_QUESTIONS = [
  { id: "where", options: [
    { id: "stay_here", monthlyDelta: 0 },
    { id: "smaller_town", monthlyDelta: -400 },
    { id: "overseas_lower_cost", monthlyDelta: -800 },
    { id: "overseas_higher_cost", monthlyDelta: 600 },
  ] },
  { id: "housing", options: [
    { id: "own_paid_off", monthlyDelta: 0 },
    { id: "still_paying", monthlyDelta: 800 },
    { id: "renting", monthlyDelta: 1400 },
    { id: "downsize", monthlyDelta: -500 },
  ] },
  { id: "work", options: [
    { id: "fully_stopped", monthlyDelta: 0 },
    { id: "part_time", monthlyDelta: -700 },
    { id: "keep_working", monthlyDelta: -1400 },
  ] },
  { id: "routine", options: [
    { id: "simple", monthlyDelta: -300 },
    { id: "comfortable", monthlyDelta: 0 },
    { id: "active_social", monthlyDelta: 400 },
  ] },
  { id: "care", options: [
    { id: "caring_for_someone", monthlyDelta: 500 },
    { id: "not_caring", monthlyDelta: 0 },
  ] },
  { id: "flexibility", options: [
    { id: "tight", monthlyDelta: 0 },
    { id: "some_room", monthlyDelta: 300 },
    { id: "lots_of_room", monthlyDelta: 700 },
  ] },
];
export const SUPPORTED_PERSON_MONTHLY = 400;

// Build the Future Day from the choices. Returns a RANGE target, and every
// choice's contribution shown transparently.
export function buildFutureDay({ choices = {}, baseMonthlyLife, baseKnown = false, now = new Date() }) {
  const base = num(baseMonthlyLife, 3000);
  const parts = [];
  let delta = 0;
  for (const q of FUTURE_DAY_QUESTIONS) {
    const pick = choices[q.id];
    const opt = q.options.find((o) => o.id === pick);
    if (opt) {
      delta += opt.monthlyDelta;
      if (opt.monthlyDelta !== 0) parts.push({ question: q.id, choice: pick, monthlyDelta: opt.monthlyDelta });
    }
  }
  const supported = Math.max(0, num(choices.supported_people));
  if (supported > 0) {
    const s = supported * SUPPORTED_PERSON_MONTHLY;
    delta += s;
    parts.push({ question: "supported_people", choice: `${supported}`, monthlyDelta: s });
  }
  const expected = Math.max(0, Math.round(base + delta));
  return {
    monthlyLifeRange: { low: Math.round(expected * 0.9), expected, high: Math.round(expected * 1.15) },
    contributions: parts,
    baseProvenance: baseKnown ? "user_confirmed" : "system_estimate",
    assumptions: [
      { text: baseKnown ? "Baseline is your current monthly expenses" : "Baseline is a Singapore reference figure until you confirm your expenses", confidence: baseKnown ? "high" : "medium", asOf: now.toISOString().slice(0, 7) },
      { text: "Each choice above adds/removes a transparent monthly amount - not a hidden score", confidence: "high" },
      { text: "The +/-10-15% band is real variance, not a forecast", confidence: "high" },
    ],
  };
}

// The full Loom. planData: {
//   future_day (the choices object), future_age, current_age,
//   monthly_contribution, inflation_assumption, longevity_years,
//   real_return_assumption?  (only used for the labelled optimistic band)
// }
// context: {
//   monthlyIncome, monthlyExpenses, otherGoalsMonthlyOutflow,
//   cpfLifeMonthly? (confirmed), existingRetirementAssets? (confirmed),
//   emergencyBufferMonths, now
// }
export function computeFutureLoom({ planData = {}, context = {} }) {
  const now = context.now ?? new Date();
  const expensesKnown = num(context.monthlyExpenses) > 0;
  const day = buildFutureDay({
    choices: planData.future_day ?? {},
    baseMonthlyLife: expensesKnown ? context.monthlyExpenses : 3000,
    baseKnown: expensesKnown,
    now,
  });

  const currentAgeKnown = planData.current_age != null;
  const currentAge = currentAgeKnown ? num(planData.current_age) : null;
  const futureAge = num(planData.future_age, currentAge != null ? currentAge + 25 : 65);
  const yearsToAccumulate = currentAge != null ? Math.max(1, futureAge - currentAge) : 25;
  const longevityYears = num(planData.longevity_years, 25); // drawdown duration
  const infl = num(planData.inflation_assumption, 2.5) / 100;
  const inflFactor = Math.pow(1 + infl, yearsToAccumulate);

  // Inflation-adjusted target RANGE (monthly, at the future date).
  const adj = (v) => Math.round(v * inflFactor);
  const targetMonthlyRange = {
    low: adj(day.monthlyLifeRange.low),
    expected: adj(day.monthlyLifeRange.expected),
    high: adj(day.monthlyLifeRange.high),
  };

  // Confirmed income sources only.
  const cpfKnown = context.cpfLifeMonthly != null;
  const cpfMonthly = cpfKnown ? Math.max(0, num(context.cpfLifeMonthly)) : 0;
  const assetsKnown = context.existingRetirementAssets != null;
  const assetsMonthly = assetsKnown ? Math.round(Math.max(0, num(context.existingRetirementAssets)) / (longevityYears * 12)) : 0;
  const confirmedMonthlyIncome = cpfMonthly + assetsMonthly;

  // Funding gap RANGE (monthly, then as a nest-egg over the drawdown).
  const gapMonthly = {
    low: Math.max(0, targetMonthlyRange.low - confirmedMonthlyIncome),
    expected: Math.max(0, targetMonthlyRange.expected - confirmedMonthlyIncome),
    high: Math.max(0, targetMonthlyRange.high - confirmedMonthlyIncome),
  };
  const nestEgg = {
    low: gapMonthly.low * longevityYears * 12,
    expected: gapMonthly.expected * longevityYears * 12,
    high: gapMonthly.high * longevityYears * 12,
  };

  // Required contribution RANGE. Base = contributed amount only, NO return.
  const months = yearsToAccumulate * 12;
  const contribNoReturn = {
    low: Math.round(nestEgg.low / months),
    expected: Math.round(nestEgg.expected / months),
    high: Math.round(nestEgg.high / months),
  };
  // Optional labelled optimistic band - only with a stated assumption.
  const rr = planData.real_return_assumption != null ? num(planData.real_return_assumption) / 100 : null;
  const withReturn = rr != null && rr > 0
    ? {
        assumptionPercent: num(planData.real_return_assumption),
        expected: Math.round(sinkingFundPayment(nestEgg.expected, rr / 12, months)),
        note: `Assumes a ${planData.real_return_assumption}% real return every year - an assumption, never a guarantee`,
      }
    : null;

  const contribution = Math.max(0, num(planData.monthly_contribution));
  // Open Future Band: how much of the HIGH scenario the current
  // contribution already covers (0..1) - what future the customer can still
  // choose, not just the gap.
  const openFutureBand = contribNoReturn.high > 0 ? Math.min(1, Math.round((contribution / contribNoReturn.high) * 100) / 100) : 1;
  const coversExpected = contribution >= contribNoReturn.expected;

  const income = num(context.monthlyIncome);
  const currentBreathingRoomAfter = income > 0 ? Math.round(income - num(context.monthlyExpenses) - num(context.otherGoalsMonthlyOutflow) - contribution) : null;
  const liquidityConflict = currentBreathingRoomAfter != null && currentBreathingRoomAfter < 0;

  const minBreathing = num(planData.minimum_current_breathing_room, 0);
  const belowBreathing = currentBreathingRoomAfter != null && currentBreathingRoomAfter < minBreathing;

  const sealable = !liquidityConflict && !belowBreathing;
  const sealableReason = liquidityConflict ? "contribution_exceeds_cashflow" : belowBreathing ? "below_current_breathing_room" : "ok";

  return {
    available: true,
    futureDay: day,
    futureAge,
    yearsToAccumulate,
    longevityYears,
    inflationAssumption: { value: num(planData.inflation_assumption, 2.5), provenance: planData.inflation_assumption != null ? "user_confirmed" : "system_estimate", note: "assumption" },
    targetMonthlyRange,
    confirmedMonthlyIncome: fig(confirmedMonthlyIncome, cpfKnown || assetsKnown ? "bank_confirmed" : "unknown", { cpf: cpfKnown ? cpfMonthly : null, fromAssets: assetsKnown ? assetsMonthly : null }),
    gapMonthlyRange: gapMonthly,
    nestEggRange: nestEgg,
    requiredContributionRange: contribNoReturn,
    optimisticContribution: withReturn,
    currentContribution: fig(contribution, planData.monthly_contribution != null ? "user_confirmed" : "system_estimate"),
    openFutureBand,
    coversExpected,
    currentBreathingRoomAfter: fig(currentBreathingRoomAfter, income > 0 ? "system_estimate" : "unknown"),
    liquidityConflict,
    belowBreathing,
    sealable,
    sealableReason,
    assumptions: [
      ...day.assumptions,
      { text: "No investment return is assumed in the required contribution - contributed amount only", confidence: "high" },
      { text: `Inflation assumption ${num(planData.inflation_assumption, 2.5)}% p.a. over ${yearsToAccumulate} years`, confidence: "medium", asOf: now.toISOString().slice(0, 7) },
      cpfKnown ? null : { text: "CPF LIFE payout not confirmed - shown as unknown, not counted", confidence: "high" },
      { text: "No inheritance and no unconfirmed partner assets are counted", confidence: "high" },
    ].filter(Boolean),
    unknowns: [
      expensesKnown ? null : "monthly_expenses",
      cpfKnown ? null : "cpf_life_monthly",
      assetsKnown ? null : "existing_retirement_assets",
      currentAgeKnown ? null : "current_age",
    ].filter(Boolean),
  };
}

// Sinking-fund payment: the monthly amount that ACCUMULATES to `future`
// over `months` at `monthlyRate`. (Not a drawdown annuity.)
function sinkingFundPayment(future, monthlyRate, months) {
  if (monthlyRate <= 0) return future / months;
  return (future * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
}

// Back-solve: the contribution range needed to cover the Future Day by a
// chosen number of years (no return assumed).
export function requiredContributionForFutureDay({ loom, byYears }) {
  if (!loom?.available || !(byYears > 0)) return null;
  const months = byYears * 12;
  return {
    low: Math.round(loom.nestEggRange.low / months),
    expected: Math.round(loom.nestEggRange.expected / months),
    high: Math.round(loom.nestEggRange.high / months),
  };
}
