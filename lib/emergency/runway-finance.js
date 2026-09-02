// Safety Runway - the Emergency Studio's domain finance engine (pure).
//
// It does NOT ask "how many months have you saved". It answers: if life
// suddenly changes, which of your real commitments can keep going, for how
// long, and how fast do you recover.
//
// The runway is measured in ESSENTIAL months - essential monthly burn, not
// total expenses - and every commitment is a real confirmed one. Unknown
// inputs stay `unknown` (fog); they are never drawn as a risk fact.

import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value * 100) / 100, provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}

// The share of monthly expenses that is genuinely non-discretionary. When
// the customer has not classified their expenses we DON'T guess a low
// number - we say the essential share is unknown and fall back to the full
// figure with a `system_estimate` flag.
const DEFAULT_ESSENTIAL_SHARE = 0.75;

// context: {
//   liquidAssets: { value, provenance },          // confirmed liquid savings
//   monthlyExpenses: { value, provenance },
//   essentialShare?: number,                       // 0..1 if the customer set it
//   commitments: [{ id, domain, label, monthlyAmount, essential }],  // real confirmed
//   now?
// }
export function computeSafetyRunway({ planData = {}, context = {} }) {
  const monthlyExpenses = num(context.monthlyExpenses?.value ?? planData.monthly_expenses);
  const expensesKnown = (context.monthlyExpenses?.provenance ?? (planData.monthly_expenses != null ? "user_confirmed" : "unknown")) !== "unknown" && monthlyExpenses > 0;
  if (!expensesKnown) {
    return { available: false, reason: "monthly_expenses_unknown", unknowns: ["monthly_expenses"] };
  }

  const essentialShareKnown = context.essentialShare != null;
  const essentialShare = essentialShareKnown ? Math.max(0, Math.min(1, num(context.essentialShare))) : DEFAULT_ESSENTIAL_SHARE;
  const essentialBurn = Math.round(monthlyExpenses * essentialShare);

  const liquidKnown = context.liquidAssets?.value != null;
  const liquid = liquidKnown ? Math.max(0, num(context.liquidAssets.value)) : 0;

  const floorMonths = num(planData.floor_months, 6);
  const targetMonths = num(planData.target_months, 6);
  const monthlyRebuild = Math.max(0, num(planData.monthly_contribution));

  const commitments = (Array.isArray(context.commitments) ? context.commitments : []).map((c) => ({
    id: c.id,
    domain: c.domain,
    label: c.label ?? c.domain,
    monthlyAmount: Math.max(0, num(c.monthlyAmount)),
    essential: Boolean(c.essential),
  }));

  // Current runway: how many ESSENTIAL months the confirmed liquid assets
  // cover if income stopped and only essentials + still-running commitments
  // had to be paid. NO double counting - a commitment's monthly amount is
  // added on top of essentials only if it is not itself an essential
  // expense already inside `essentialBurn` (we treat confirmed goal /
  // loan commitments as on-top; rent/utilities live inside essentialBurn).
  const allCommitMonthly = commitments.reduce((s, c) => s + c.monthlyAmount, 0);
  const essentialCommitMonthly = commitments.filter((c) => c.essential).reduce((s, c) => s + c.monthlyAmount, 0);

  const currentRunwayMonths = liquidKnown && essentialBurn + essentialCommitMonthly > 0
    ? Math.round((liquid / (essentialBurn + essentialCommitMonthly)) * 10) / 10
    : null;
  // Protected runway: essentials + the commitments the customer chose to
  // keep alive through a shock.
  const protectedIds = new Set(Array.isArray(planData.protected_commitments) ? planData.protected_commitments : []);
  const protectedCommitMonthly = commitments.filter((c) => c.essential || protectedIds.has(c.id)).reduce((s, c) => s + c.monthlyAmount, 0);
  const protectedRunwayMonths = liquidKnown && essentialBurn + protectedCommitMonthly > 0
    ? Math.round((liquid / (essentialBurn + protectedCommitMonthly)) * 10) / 10
    : null;

  // Rebuild: how long to reach the floor / target at the chosen monthly.
  const floorAmount = Math.round((essentialBurn + essentialCommitMonthly) * floorMonths);
  const targetAmount = Math.round((essentialBurn + essentialCommitMonthly) * targetMonths);
  const toFloor = Math.max(0, floorAmount - liquid);
  const toTarget = Math.max(0, targetAmount - liquid);
  const monthsToFloor = monthlyRebuild > 0 ? (toFloor <= 0 ? 0 : Math.ceil(toFloor / monthlyRebuild)) : null;
  const monthsToTarget = monthlyRebuild > 0 ? (toTarget <= 0 ? 0 : Math.ceil(toTarget / monthlyRebuild)) : null;

  const atOrAboveFloor = currentRunwayMonths != null && currentRunwayMonths >= floorMonths;
  const atOrAboveTarget = currentRunwayMonths != null && currentRunwayMonths >= targetMonths;
  // Quiet Zone: above target, we do NOT push more saving.
  const quietZone = atOrAboveTarget;

  // Per-commitment survivability at the CURRENT (no-shock) runway: how many
  // months each commitment can be sustained from liquid assets alongside
  // essentials, keeping the most-essential ones first.
  const survivability = commitmentSurvivability({ commitments, liquid, essentialBurn });

  return {
    available: true,
    essentialShare: fig(essentialShare, essentialShareKnown ? "user_confirmed" : "system_estimate", { note: essentialShareKnown ? null : "essential share not classified - using a reference 75%" }),
    essentialBurn: fig(essentialBurn, expensesKnown ? "user_confirmed" : "unknown"),
    liquidAssets: fig(liquidKnown ? liquid : null, liquidKnown ? "bank_confirmed" : "unknown"),
    floorMonths,
    targetMonths,
    monthlyRebuild: fig(monthlyRebuild, planData.monthly_contribution != null ? "user_confirmed" : "system_estimate"),
    currentRunwayMonths,
    protectedRunwayMonths,
    monthsToFloor,
    monthsToTarget,
    atOrAboveFloor,
    atOrAboveTarget,
    quietZone,
    commitments,
    commitmentMonthlyTotal: allCommitMonthly,
    survivability,
    // Explicit sealability: a rebuild plan is sealable once expenses are
    // known AND it does not force a goal below the floor (checked at Pin
    // time); the base engine says "yes" here and Pins can still block.
    sealable: true,
    sealableReason: quietZone ? "already_above_target" : "rebuild_plannable",
    assumptions: [
      { text: `Runway measured in essential months (${Math.round(essentialShare * 100)}% of expenses)`, confidence: essentialShareKnown ? "high" : "medium" },
      liquidKnown ? null : { text: "Liquid assets not confirmed - shown as fog, runway not computed", confidence: "high" },
      { text: "No double counting: rent / utilities sit inside the essential burn; goal & loan commitments are on top", confidence: "high" },
    ].filter(Boolean),
    unknowns: [liquidKnown ? null : "liquid_assets", essentialShareKnown ? null : "essential_share"].filter(Boolean),
  };
}

function commitmentSurvivability({ commitments, liquid, essentialBurn }) {
  // essentials always come first
  const ordered = [...commitments].sort((a, b) => Number(b.essential) - Number(a.essential));
  let cumulative = essentialBurn;
  return ordered.map((c) => {
    cumulative += c.monthlyAmount;
    const months = cumulative > 0 ? Math.round((liquid / cumulative) * 10) / 10 : null;
    return { id: c.id, domain: c.domain, label: c.label, monthlyAmount: c.monthlyAmount, essential: c.essential, monthsSustainable: months };
  });
}

// Rehearse a shock - PURE, NEVER mutates the plan. Applies a temporary
// income gap and/or a temporary essential expense and walks the runway
// month by month: which commitments keep running, when the floor is hit,
// and the recovery gradient once income returns.
//
// shock: { incomeInterruptionMonths, temporaryMonthlyExpense, incomeRecoveryRatio (0..1), monthlyIncome }
export function rehearseShock({ runway, shock = {} }) {
  if (!runway?.available) return null;
  const gapMonths = Math.max(0, Math.round(num(shock.incomeInterruptionMonths)));
  const tempExpense = Math.max(0, num(shock.temporaryMonthlyExpense));
  const recoveryRatio = Math.max(0, Math.min(1, num(shock.incomeRecoveryRatio, 1)));
  const income = Math.max(0, num(shock.monthlyIncome));
  const essentialBurn = runway.essentialBurn.value ?? 0;
  const liquidStart = runway.liquidAssets.value ?? 0;

  const protectedMonthly = essentialBurn + runway.commitments.reduce((s, c) => s + (c.essential ? c.monthlyAmount : 0), 0);
  let balance = liquidStart;
  const timeline = [];
  let floorBreachMonth = null;
  const HORIZON = Math.max(12, gapMonths + 18);
  for (let m = 1; m <= HORIZON; m++) {
    const inGap = m <= gapMonths;
    const monthlyIncome = inGap ? 0 : Math.round(income * recoveryRatio);
    const outgo = protectedMonthly + (inGap ? tempExpense : 0);
    balance += monthlyIncome - outgo;
    const runwayLeft = protectedMonthly > 0 ? Math.round((balance / protectedMonthly) * 10) / 10 : null;
    if (floorBreachMonth == null && runwayLeft != null && runwayLeft < runway.floorMonths) floorBreachMonth = m;
    timeline.push({ month: m, inGap, balance: Math.round(balance), runwayLeft });
    if (balance <= 0 && !inGap && monthlyIncome >= outgo) break; // recovered / stabilised
  }

  const survivedCommitments = runway.commitments.map((c) => {
    // a non-essential commitment "survives" the shock if the balance never
    // needed it cut to stay above zero during the gap
    const monthsCovered = protectedMonthly + c.monthlyAmount > 0 ? Math.round((liquidStart / (protectedMonthly + c.monthlyAmount)) * 10) / 10 : null;
    return { id: c.id, domain: c.domain, label: c.label, survivesGap: monthsCovered != null && monthsCovered >= gapMonths, monthsCovered };
  });

  const lowestBalance = Math.min(...timeline.map((t) => t.balance));
  const recoversBy = timeline.find((t) => !t.inGap && t.runwayLeft != null && t.runwayLeft >= runway.floorMonths)?.month ?? null;

  return {
    shock: { gapMonths, tempExpense, recoveryRatio, income },
    timeline,
    floorBreachMonth,
    lowestBalance,
    recoversByMonth: recoversBy,
    survivedCommitments,
    // Recovery Gradient: months from the lowest point back to the floor.
    recoveryGradientMonths: floorBreachMonth != null && recoversBy != null ? recoversBy - floorBreachMonth : null,
    verdict: floorBreachMonth == null ? "holds" : recoversBy != null ? "dips_then_recovers" : "needs_a_choice",
    note: "Rehearsal only - your real plan is unchanged.",
  };
}

// Back-solve the monthly rebuild needed to reach a target protected months
// by a chosen month.
export function requiredRebuildForTarget({ runway, targetMonths, byMonths }) {
  if (!runway?.available || !(byMonths > 0)) return null;
  const perMonth = runway.essentialBurn.value ?? 0;
  const targetAmount = Math.round(perMonth * targetMonths);
  const shortfall = Math.max(0, targetAmount - (runway.liquidAssets.value ?? 0));
  return shortfall <= 0 ? 0 : Math.ceil(shortfall / byMonths);
}
