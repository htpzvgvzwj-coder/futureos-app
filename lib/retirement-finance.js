// Deterministic Singapore CPF retirement calculators. Same discipline as
// lib/home-finance.js: the AI supplies only a market-grounded target monthly
// retirement income per lifestyle option; every CPF projection, Retirement
// Sum, and CPF LIFE payout number here is computed by code, never trusted
// from the model.
//
// Rates verified via CPF Board as of 2026-07. Current-year figures only —
// no birth-cohort differentiation (BRS/FRS/ERS technically vary by the year
// a member turns 55, but this app uses the current-year numbers uniformly
// for every user, by design). Re-verify against https://www.cpf.gov.sg
// before relying on this in a non-prototype context — these figures change
// with government policy and are reviewed/updated at least annually.

export const RETIREMENT_SUMS_2026 = { BRS: 110_200, FRS: 220_400, ERS: 440_800 };

const CONTRIBUTION_RATE_BANDS = [
  { maxAge: 55, totalRate: 0.37 },
  { maxAge: 60, totalRate: 0.34 },
  { maxAge: 65, totalRate: 0.25 },
  { maxAge: 70, totalRate: 0.165 },
  { maxAge: Infinity, totalRate: 0.125 },
];

// Verified via CPF Board contribution/allocation tables effective
// 2026-01-01 (cross-checked across cpf.gov.sg articles and employer
// advisory sources). oa/saOrRa/ma are fractions OF WAGE, not of totalRate.
// raInsteadOfSa flips true at 56+ (SA closes at 55, RA takes its place);
// once RA savings hit the prevailing FRS, RA-directed contributions
// redirect to OA instead (modeled in simulateOneYear, not here).
const ALLOCATION_BANDS = [
  { maxAge: 35, oa: 0.23, saOrRa: 0.06, ma: 0.08, raInsteadOfSa: false },
  { maxAge: 45, oa: 0.21, saOrRa: 0.07, ma: 0.09, raInsteadOfSa: false },
  { maxAge: 50, oa: 0.19, saOrRa: 0.08, ma: 0.1, raInsteadOfSa: false },
  { maxAge: 55, oa: 0.15, saOrRa: 0.115, ma: 0.105, raInsteadOfSa: false },
  { maxAge: 60, oa: 0.12, saOrRa: 0.115, ma: 0.105, raInsteadOfSa: true },
  { maxAge: 65, oa: 0.035, saOrRa: 0.11, ma: 0.105, raInsteadOfSa: true },
  { maxAge: 70, oa: 0.01, saOrRa: 0.05, ma: 0.105, raInsteadOfSa: true },
  { maxAge: Infinity, oa: 0.01, saOrRa: 0.01, ma: 0.105, raInsteadOfSa: true },
];

const INTEREST = {
  oa: 0.025,
  saMaRa: 0.04,
  extraUnder55: { rate: 0.01, combinedCap: 60_000, maxFromOa: 20_000 },
  extraOver55: { tier1: { rate: 0.02, cap: 30_000 }, tier2: { rate: 0.01, cap: 30_000 } },
};

const OW_CEILING_MONTHLY = 8_000; // 2026, final step of a phased increase

// Illustrative anchors CPF Board publishes (Standard Plan, RA balance set
// aside at 55, payouts starting at 65). CPF Board does not publish a
// closed-form payout formula (it depends on cohort mortality tables, sex,
// and prevailing rates at annuitization) — estimateCpfLifePayout()
// interpolates/extrapolates between these three points as an approximation.
const CPF_LIFE_STANDARD_ANCHORS = [
  { raAt55: 110_200, raAt65: 170_100, monthlyPayout: 950 },
  { raAt55: 220_400, raAt65: 330_100, monthlyPayout: 1_780 },
  { raAt55: 440_800, raAt65: 650_100, monthlyPayout: 3_440 },
];

// Basic pools a smaller share of RA savings so starts lower; Escalating
// starts lower than Standard and grows ~2%/yr. Both approximated here as a
// flat multiplier off the Standard estimate rather than independently
// modeled — flagged as a simplification.
const PLAN_STARTING_MULTIPLIER = { standard: 1, basic: 0.75, escalating: 0.85 };

const CPF_LIFE_DEFERRAL_BONUS_PER_YEAR = 0.07; // +7%/yr deferred 65->70, capped at +35% at 70

function getBand(bands, age) {
  return bands.find((band) => age <= band.maxAge) ?? bands[bands.length - 1];
}

export function getContributionRate(age) {
  return getBand(CONTRIBUTION_RATE_BANDS, age).totalRate;
}

export function getAllocationBand(age) {
  return getBand(ALLOCATION_BANDS, age);
}

export function splitMonthlyContribution({ age, monthlyWage }) {
  const ordinaryWage = Math.min(monthlyWage, OW_CEILING_MONTHLY);
  const band = getAllocationBand(age);
  return {
    oa: ordinaryWage * band.oa,
    saOrRa: ordinaryWage * band.saOrRa,
    ma: ordinaryWage * band.ma,
    ordinaryWage,
    raInsteadOfSa: band.raInsteadOfSa,
  };
}

function extraInterestForBalances(balances, age) {
  const combined = balances.oa + balances.sa + balances.ma + balances.ra;
  if (age < 55) {
    const { rate, combinedCap, maxFromOa } = INTEREST.extraUnder55;
    const eligibleBase = Math.min(combined, combinedCap);
    const fromOa = Math.min(balances.oa, maxFromOa, eligibleBase);
    return fromOa * rate + Math.max(0, eligibleBase - fromOa) * rate;
  }
  const { tier1, tier2 } = INTEREST.extraOver55;
  const tier1Amount = Math.min(combined, tier1.cap);
  const tier2Amount = Math.min(Math.max(0, combined - tier1.cap), tier2.cap);
  return tier1Amount * tier1.rate + tier2Amount * tier2.rate;
}

// One year of monthly contributions + interest over {oa, sa, ma, ra}.
// Extra interest is computed once for the year off the starting balance
// (a simplification vs. recomputing monthly) and credited into SA (or RA
// for 55+), matching CPF's rule that extra interest earned "on OA" is
// actually paid into SA/RA rather than OA itself.
function simulateOneYear({ age, balances, monthlyWage }) {
  const contribution = splitMonthlyContribution({ age, monthlyWage });
  const next = { ...balances };

  for (let month = 0; month < 12; month += 1) {
    next.oa += contribution.oa;
    next.ma += contribution.ma;
    if (contribution.raInsteadOfSa) {
      const raRoomLeft = Math.max(0, RETIREMENT_SUMS_2026.FRS - next.ra);
      const toRa = Math.min(contribution.saOrRa, raRoomLeft);
      next.ra += toRa;
      next.oa += contribution.saOrRa - toRa; // FRS met: redirect excess to OA
    } else {
      next.sa += contribution.saOrRa;
    }
  }

  const extraInterest = extraInterestForBalances(balances, age);
  next.oa += balances.oa * INTEREST.oa;
  next.sa += balances.sa * INTEREST.saMaRa;
  next.ma += balances.ma * INTEREST.saMaRa;
  next.ra += balances.ra * INTEREST.saMaRa;
  if (age < 55) {
    next.sa += extraInterest;
  } else {
    next.ra += extraInterest;
  }

  // Age-55 event: RA is created, SA closes, SA then OA fund it up to FRS.
  if (age === 54) {
    const toRaFromSa = Math.min(next.sa, RETIREMENT_SUMS_2026.FRS);
    let ra = toRaFromSa;
    let sa = next.sa - toRaFromSa;
    let oa = next.oa;
    if (ra < RETIREMENT_SUMS_2026.FRS) {
      const toRaFromOa = Math.min(oa, RETIREMENT_SUMS_2026.FRS - ra);
      ra += toRaFromOa;
      oa -= toRaFromOa;
    }
    next.ra += ra;
    next.sa = sa;
    next.oa = oa;
  }

  return next;
}

// Loop simulateOneYear from currentAge to retirementAge. Chosen over a
// closed-form formula: this runs entirely server-side with no external
// calls (microseconds for a 40-year loop), and a closed form can't cleanly
// express the extra-interest tiers, OW ceiling, or the age-55 transition.
export function projectCpfBalances({
  currentAge,
  retirementAge = 65,
  currentBalances = { oa: 0, sa: 0, ma: 0, ra: 0 },
  monthlyWage,
}) {
  let balances = { oa: 0, sa: 0, ma: 0, ra: 0, ...currentBalances };
  const trajectory = [{ age: currentAge, ...balances }];
  let raAt55 = currentAge >= 55 ? balances.ra : null;

  for (let age = currentAge; age < retirementAge; age += 1) {
    balances = simulateOneYear({ age, balances, monthlyWage });
    if (age + 1 === 55) raAt55 = balances.ra;
    trajectory.push({ age: age + 1, ...balances });
  }

  return { trajectory, raAt55: raAt55 ?? balances.ra, raAtRetirement: balances.ra };
}

// Default when the user skips entering real CPF balances: assumes
// continuous contribution from age 23 at their current income. A
// deterministic default, not an AI guess.
export function estimateCurrentCpfBalances({ currentAge, monthlyIncome, startAge = 23 }) {
  if (currentAge <= startAge) return { oa: 0, sa: 0, ma: 0, ra: 0 };
  const { raAtRetirement: _unused, trajectory } = projectCpfBalances({
    currentAge: startAge,
    retirementAge: currentAge,
    monthlyWage: monthlyIncome,
  });
  const last = trajectory[trajectory.length - 1];
  return { oa: last.oa, sa: last.sa, ma: last.ma, ra: last.ra };
}

function interpolatePayout(raAtRetirement) {
  const anchors = CPF_LIFE_STANDARD_ANCHORS;
  if (raAtRetirement <= anchors[0].raAt65) {
    const ratio = raAtRetirement / anchors[0].raAt65;
    return anchors[0].monthlyPayout * ratio;
  }
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const lower = anchors[i];
    const upper = anchors[i + 1];
    if (raAtRetirement <= upper.raAt65) {
      const ratio = (raAtRetirement - lower.raAt65) / (upper.raAt65 - lower.raAt65);
      return lower.monthlyPayout + ratio * (upper.monthlyPayout - lower.monthlyPayout);
    }
  }
  const last = anchors[anchors.length - 1];
  const secondLast = anchors[anchors.length - 2];
  const slope = (last.monthlyPayout - secondLast.monthlyPayout) / (last.raAt65 - secondLast.raAt65);
  return last.monthlyPayout + slope * (raAtRetirement - last.raAt65);
}

export function estimateCpfLifePayout(raAtRetirement, { plan = "standard", payoutAge = 65 } = {}) {
  const basePayout = interpolatePayout(Math.max(0, raAtRetirement));
  const planMultiplier = PLAN_STARTING_MULTIPLIER[plan] ?? PLAN_STARTING_MULTIPLIER.standard;
  const deferralYears = Math.min(5, Math.max(0, payoutAge - 65));
  const deferralBonus = 1 + deferralYears * CPF_LIFE_DEFERRAL_BONUS_PER_YEAR;
  return {
    monthlyPayout: Math.round(basePayout * planMultiplier * deferralBonus),
    planNote:
      plan === "basic"
        ? "Basic Plan: lower starting payout, most RA savings retained and drawn down over time, largest bequest."
        : plan === "escalating"
          ? "Escalating Plan: starts lower than Standard, increases ~2% every year for life."
          : "Standard Plan: level payout for life, highest starting amount of the three plans.",
  };
}

export function computeRetirementGap({ targetMonthlyIncome, cpfLifePayout }) {
  const gapMonthly = Math.max(0, Math.round(targetMonthlyIncome - cpfLifePayout));
  const cpfCoveragePercent =
    targetMonthlyIncome > 0 ? Math.min(100, Math.round((cpfLifePayout / targetMonthlyIncome) * 100)) : 0;
  return { gapMonthly, cpfCoveragePercent };
}

// Top-level orchestrator, mirrors computeHomeFinancials. AI-supplied
// targetMonthlyIncome is the only untrusted input; everything else here is
// code.
export function computeRetirementFinancials({
  targetMonthlyIncome,
  currentAge,
  retirementAge = 65,
  currentBalances,
  monthlyIncome,
  cpfLifePlan = "standard",
  payoutAge = 65,
}) {
  const balances =
    currentBalances ?? estimateCurrentCpfBalances({ currentAge, monthlyIncome });
  const { raAt55, raAtRetirement } = projectCpfBalances({
    currentAge,
    retirementAge,
    currentBalances: balances,
    monthlyWage: monthlyIncome,
  });
  const { monthlyPayout, planNote } = estimateCpfLifePayout(raAtRetirement, { plan: cpfLifePlan, payoutAge });
  const { gapMonthly, cpfCoveragePercent } = computeRetirementGap({
    targetMonthlyIncome,
    cpfLifePayout: monthlyPayout,
  });
  return {
    target_monthly_income: targetMonthlyIncome,
    ra_at_55: Math.round(raAt55),
    ra_at_retirement: Math.round(raAtRetirement),
    cpf_life_payout: monthlyPayout,
    cpf_life_plan_note: planNote,
    gap_monthly: gapMonthly,
    cpf_coverage_percent: cpfCoveragePercent,
    retirement_sums: RETIREMENT_SUMS_2026,
  };
}
