// Future Field - the pure math behind the five original actions (no DB/AI).
//
//   Peel   : split a possible future off the reality path (a plan_branch)
//   Bend   : move an OUTCOME (a date, a target); solve the METHOD backwards
//   Pin    : check a plan against structured constraints
//   Seal   : build the explicit, revocable consent summary
//   Catch-up: compare the real path against the committed path
//
// The field holds exactly three kinds of path: reality (bank-confirmed),
// possible (Mirror branches, half-transparent), committed (Guardian is
// following). This module computes the relationships between them; it does
// not render anything and it invents no numbers.

import { mergeBranchData, diffPlanData } from "./plan-model.js";

// -------------------------------------------------------------------------
// Peel
// -------------------------------------------------------------------------

// Given the base version's data and a set of overrides, produce the branch's
// full data plus the minimal delta (what actually differs). feasibilityFn is
// a caller-supplied real calculator (e.g. computeHomeFinancials) applied to
// the branch data - never a guess.
export function peelBranch({ baseData, overrides, feasibilityFn = null }) {
  const data = { ...baseData, ...overrides };
  const { before, after, changedKeys } = diffPlanData(baseData, data);
  const feasibility = typeof feasibilityFn === "function" ? feasibilityFn(data) : {};
  return {
    data,
    delta: { before, after, changedKeys },
    feasibility,
  };
}

// Compare N branches on a fixed set of metrics -> a table the UI renders
// directly. metricFns: { metricName: (branchData, feasibility) => number }.
export function compareBranches(branches, metricFns) {
  const metrics = Object.keys(metricFns);
  return {
    metrics,
    rows: branches.map((b) => ({
      id: b.id ?? b.label,
      label: b.label,
      values: Object.fromEntries(metrics.map((m) => [m, metricFns[m](b.data ?? {}, b.feasibility ?? {})])),
    })),
  };
}

// Merge selected fields from two branches (Future Field "Merge").
export function mergeBranches(branchA, branchB, pickMap) {
  return mergeBranchData(branchA.data ?? {}, branchB.data ?? {}, pickMap);
}

// -------------------------------------------------------------------------
// Bend - move the result, solve the method backwards
// -------------------------------------------------------------------------

// Invert a monotonic "months-to-ready given monthly amount" projection: the
// customer drags the ready date to `targetMonths` from now; solve the
// monthly contribution that achieves it. `projectMonthsFn(monthlyAmount)`
// must return months-to-ready (a real projector, e.g. from
// home-draft-finance.js), and be non-increasing in monthlyAmount.
export function solveMonthlyForTargetMonths({ targetMonths, projectMonthsFn, lowAmount = 0, highAmount = 100000, tolerance = 1 }) {
  if (!(targetMonths > 0)) return null;
  let lo = lowAmount;
  let hi = highAmount;
  // Guard: even at the ceiling the date can't be hit.
  const atHi = projectMonthsFn(hi);
  if (atHi == null || atHi > targetMonths) return { amount: null, achievable: false, projectedMonths: atHi ?? null };

  for (let i = 0; i < 60 && hi - lo > tolerance; i += 1) {
    const mid = (lo + hi) / 2;
    const months = projectMonthsFn(mid);
    if (months == null || months > targetMonths) lo = mid;
    else hi = mid;
  }
  const amount = Math.ceil(hi);
  return { amount, achievable: true, projectedMonths: projectMonthsFn(amount) };
}

// Generic Bend: the customer moved one outcome; recompute the levers and the
// knock-on effect on other goals. `outcome` = { metric, from, to }.
// `solveFn(to) -> { levers, sideEffects }` is the caller's real solver.
export function bendOutcome({ outcome, solveFn }) {
  const solved = solveFn(outcome.to);
  return {
    outcome,
    moved: outcome.to !== outcome.from,
    ...solved,
  };
}

// -------------------------------------------------------------------------
// Pin - check plan data against structured constraints
// -------------------------------------------------------------------------

// constraint rows use { kind, operator (gte|lte|eq|flag), value }. `metrics`
// is a map from constraint kind -> the plan's real current value for it.
// Returns the violations, each with the real gap.
export function checkConstraints(constraints, metrics) {
  const violations = [];
  for (const c of constraints) {
    const actual = metrics[c.kind];
    if (actual == null) continue; // can't evaluate honestly -> not a violation, a gap
    const target = Number(c.value);
    let violated = false;
    if (c.operator === "gte") violated = actual < target;
    else if (c.operator === "lte") violated = actual > target;
    else if (c.operator === "eq") violated = actual !== target;
    else if (c.operator === "flag") violated = actual === true;
    if (violated) {
      violations.push({
        kind: c.kind,
        operator: c.operator,
        target: c.operator === "flag" ? null : target,
        actual,
        gap: c.operator === "flag" ? null : Math.round((actual - target) * 100) / 100,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

// -------------------------------------------------------------------------
// Seal - the explicit, revocable consent summary
// -------------------------------------------------------------------------

// Everything the customer must see before a possible future becomes a
// commitment. No side effects - the route writes the commitment/policy only
// after the customer confirms this exact summary.
export function buildSealPreview({ branch, planDomain, monthlyAmount, effectiveMonth, readyMonth, constraintCheck, guardianCapabilities, autoPauseConditions, isShadowOnly = true, reconfirmAfterDays = 180 }) {
  return {
    domain: planDomain,
    branchLabel: branch?.label ?? null,
    amount: monthlyAmount,
    effectiveMonth,
    readyMonth: readyMonth ?? null,
    dataSources: (branch?.feasibility?.sources ?? []).slice(0, 6),
    keyAssumptions: branch?.feasibility?.assumptions ?? [],
    guardianCan: guardianCapabilities ?? { moveMoney: false, reschedule: false, notify: true },
    autoPauseWhen: autoPauseConditions ?? [],
    reconfirmAfterDays,
    reversible: true,
    // The single most important honesty line: is this a real bank action or
    // still only a shadow simulation?
    execution: isShadowOnly ? "shadow_only" : "scheduled_no_bank_transfer",
    respectsPins: constraintCheck?.ok ?? true,
    pinViolations: constraintCheck?.violations ?? [],
  };
}

// -------------------------------------------------------------------------
// Catch-up - reality vs committed
// -------------------------------------------------------------------------

// committed = { monthlyContribution, startMonth, targetMonth, downPaymentNeeded, currentSavingsAtStart }
// realityCheckins = [{ month: 'YYYY-MM', amount }]
// projectFn(currentSavings, monthlyAmount) -> months-to-ready (real projector)
export function compareRealityToCommitted({ committed, realityCheckins = [], currentSavingsNow, projectFn, pausedConstraint = null, rescued = false, now = new Date() }) {
  const logged = realityCheckins.filter((c) => c && c.month <= now.toISOString().slice(0, 7));
  const monthsLogged = logged.length;
  const actualCumulative = logged.reduce((s, c) => s + Number(c.amount || 0), 0);
  const expectedCumulative = Number(committed.monthlyContribution) * monthsLogged;

  const projectedAtCommitted = projectFn(committed.currentSavingsAtStart, committed.monthlyContribution);
  const effectivePace = monthsLogged > 0 ? actualCumulative / monthsLogged : 0;
  const projectedAtReality = projectFn(currentSavingsNow, effectivePace);

  let status;
  if (pausedConstraint) status = "paused";
  else if (rescued) status = "rescued";
  else if (projectedAtReality == null) status = "separating";
  else if (monthsLogged === 0) status = "no_signal";
  else if (actualCumulative >= expectedCumulative) status = "approaching";
  else status = "separating";

  const driftMonths =
    projectedAtReality != null && projectedAtCommitted != null ? projectedAtReality - projectedAtCommitted : null;

  return {
    status, // approaching | separating | paused | rescued | complete | no_signal
    monthsLogged,
    actualCumulative: Math.round(actualCumulative),
    expectedCumulative: Math.round(expectedCumulative),
    shortfall: Math.round(expectedCumulative - actualCumulative),
    effectivePace: Math.round(effectivePace),
    driftMonths: driftMonths == null ? null : Math.round(driftMonths),
    pausedByPin: pausedConstraint?.kind ?? null,
  };
}
