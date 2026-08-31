// Typed ImpactMeasure - the one shape every cross-goal effect in the Life
// Thread must use (Living Thread, causal-spine round).
//
// Hard rules, enforced here:
//   1. Heterogeneous units are NEVER added. sgd, sgd_per_month, months,
//      percentage and date_shift_months live in separate buckets.
//   2. `direction` is derived from `delta` (or a metric-specific
//      comparator), NEVER from the sign of `possibleAfter`.
//   3. Aggregation groups by targetGoalId + metric + unit. There is no
//      "total impact score".
//   4. A measure with no `unit` is rejected / marked invalid, never
//      silently coerced.
//
// Pure: no React, no DB, no network.

export const IMPACT_UNITS = [
  "sgd", // a one-off amount
  "sgd_per_month", // a recurring monthly amount
  "months", // a duration / a count of months (e.g. buffer months)
  "percentage", // 0..100 or 0..1 - a ratio
  "date_shift_months", // signed: - = earlier, + = later
  "count", // a plain integer count (people, guests, ...)
];

export function isImpactUnit(u) {
  return typeof u === "string" && IMPACT_UNITS.includes(u);
}

// Which way is "the metric's value moved" derived purely from the numeric
// change. `direction` is descriptive ("value rose / fell"), NOT a
// good/bad judgement - a separate `favourable` flag carries that.
const HIGHER_IS_BETTER = new Set([
  "emergencyBufferMonths",
  "currentBreathingRoom",
  "monthlyRoom",
  "liquidCapital",
  "openFutureBand",
  "coverRatio",
  "readyMonthsEarlier",
  "fundedFraction",
]);
const LOWER_IS_BETTER = new Set([
  "gapMonthly",
  "monthsToTarget",
  "monthsToDebtFree",
  "monthsToReady",
  "knownExposure",
  "requiredMonthly",
  "yearsToTarget",
  "planTotal",
  "addedPressureMonthly",
  "budgetGap",
  "monthsOfBufferForegone",
  "readyMonthShift", // more negative = earlier = better
]);
// Metrics whose favourable direction is "up".
HIGHER_IS_BETTER.add("postPurchaseBufferMonths");
HIGHER_IS_BETTER.add("monthlyBreathingRoom");
HIGHER_IS_BETTER.add("liquidCashAfterPurchase");
HIGHER_IS_BETTER.add("monthlyContributionCapacity");

function num(v) {
  if (v == null || v === "") return null; // Number(null) === 0 - guard it
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// direction: "up" | "down" | "flat" - the sign of the change in the
// metric's value. `comparator(before, after)` overrides for non-numeric
// metrics (e.g. a date string). possibleAfter is NEVER consulted for the
// sign.
export function directionFor({ metric, before = null, after = null, delta = null, comparator = null } = {}) {
  if (typeof comparator === "function") {
    const r = comparator(before, after);
    return r === "up" || r === "down" || r === "flat" ? r : "flat";
  }
  let d = num(delta);
  if (d == null) {
    const b = num(before);
    const a = num(after);
    if (b != null && a != null) d = a - b;
  }
  if (d == null) return "flat";
  if (Math.abs(d) < 1e-9) return "flat";
  return d > 0 ? "up" : "down";
}

// Whether a change in this metric is favourable for the customer. Derived
// from the metric's known semantics + the direction. Unknown metric ->
// null (honest: we do not judge it).
export function favourableFor({ metric, direction }) {
  if (direction === "flat") return null;
  if (HIGHER_IS_BETTER.has(metric)) return direction === "up";
  if (LOWER_IS_BETTER.has(metric)) return direction === "down";
  return null;
}

// The three effect states a cross-goal impact moves through.
//   possible  - the customer is exploring; a Ghost
//   placed    - the customer chose a destination for a released resource,
//               but has NOT sealed; still a Ghost (just a definite one)
//   confirmed - the plan was Sealed; a Solid effect
export const EFFECT_STATES = ["possible", "placed", "confirmed"];
export const EFFECT_KINDS = ["direct_pressure", "released_resource", "allocation", "informational"];

// Build one typed ImpactMeasure. Returns { valid: false, invalidReason }
// when the input cannot be trusted. `delta` is computed from
// before/possibleAfter when omitted; `direction` is ALWAYS re-derived here
// from delta. A `confirmedAfter` may ONLY be set when effectState is
// "confirmed" - the builder nulls it otherwise so a placed/exploring
// branch can never leak a Solid number.
export function buildImpactMeasure(input = {}) {
  const {
    sourcePlanId = null,
    sourceBranchId = null,
    sourceMomentId = null,
    sourceType = "studio_branch",
    resourceId = null,
    targetGoalId = null,
    allocationTargetGoalId = null,
    metric = null,
    unit = null,
    effectKind = "informational",
    effectState = null,
    before = null,
    possibleAfter = null,
    placedAfter = null,
    confirmedAfter = null,
    confidence = "medium",
    assumptions = [],
    provenance = "system_estimate",
    evidenceWindow = null,
    comparator = null,
  } = input;

  if (!targetGoalId) return { valid: false, invalidReason: "missing_targetGoalId" };
  if (!metric) return { valid: false, invalidReason: "missing_metric" };
  if (!isImpactUnit(unit)) return { valid: false, invalidReason: "missing_or_unknown_unit", unit: unit ?? null };
  if (effectKind != null && !EFFECT_KINDS.includes(effectKind)) return { valid: false, invalidReason: "bad_effectKind", effectKind };

  const b = num(before);
  const pa = num(possibleAfter);
  let delta = num(input.delta);
  if (delta == null && b != null && pa != null) delta = pa - b;

  const direction = directionFor({ metric, before: b, after: pa, delta, comparator });
  const favourable = favourableFor({ metric, direction });

  // effectState is INFERRED from which "after" the caller supplied when it
  // is not stated outright, so a legacy caller passing only confirmedAfter
  // still resolves to "confirmed".
  let state = effectState;
  if (!EFFECT_STATES.includes(state)) {
    state = confirmedAfter != null ? "confirmed" : placedAfter != null ? "placed" : "possible";
  }

  // possible -> Ghost, no committed number.
  // placed   -> Ghost, but a definite destination: `placedAfter` is set,
  //             `confirmedAfter` still null (nothing is Solid until Seal).
  // confirmed -> Sealed: `confirmedAfter` is the one Solid number.
  const placed =
    state === "placed" || state === "confirmed" ? num(placedAfter) ?? num(confirmedAfter) ?? pa : null;
  const confirmed = state === "confirmed" ? num(confirmedAfter) ?? num(placedAfter) ?? pa : null;

  return {
    valid: true,
    sourcePlanId,
    sourceBranchId,
    sourceMomentId,
    sourceType,
    resourceId,
    targetGoalId,
    allocationTargetGoalId,
    metric,
    unit,
    effectKind: effectKind ?? "informational",
    effectState: state,
    before: b,
    delta,
    possibleAfter: pa,
    placedAfter: placed,
    confirmedAfter: confirmed,
    direction,
    favourable,
    confidence,
    assumptions: Array.isArray(assumptions) ? assumptions.map((a) => (typeof a === "string" ? { text: a } : a)) : [],
    provenance,
    evidenceWindow,
  };
}

export function validateImpactMeasure(m) {
  const errors = [];
  if (!m || typeof m !== "object") return { ok: false, errors: ["measure missing"] };
  if (m.valid === false) return { ok: false, errors: [m.invalidReason ?? "invalid"] };
  if (!m.targetGoalId) errors.push("missing targetGoalId");
  if (!m.metric) errors.push("missing metric");
  if (!isImpactUnit(m.unit)) errors.push("missing or unknown unit");
  if (!["up", "down", "flat"].includes(m.direction)) errors.push("bad direction");
  if (m.effectState != null && !EFFECT_STATES.includes(m.effectState)) errors.push("bad effectState");
  if (m.effectState != null && m.effectState !== "confirmed" && m.confirmedAfter != null) {
    errors.push("confirmedAfter set outside the confirmed state");
  }
  return { ok: errors.length === 0, errors };
}

const groupKey = (m) => `${m.targetGoalId}::${m.metric}::${m.unit}`;

// Aggregate a list of measures. Groups by targetGoalId + metric + unit
// (rule 3). Deltas are summed ONLY inside a group - never across units
// (rule 1). There is NO cross-group total (rule 4).
export function aggregateImpactMeasures(measures = []) {
  const groups = new Map();
  const invalid = [];
  for (const raw of measures) {
    const m = raw && raw.valid === false ? raw : raw;
    const v = validateImpactMeasure(m);
    if (!v.ok) {
      invalid.push({ measure: raw, errors: v.errors });
      continue;
    }
    const k = groupKey(m);
    const g = groups.get(k) ?? {
      targetGoalId: m.targetGoalId,
      metric: m.metric,
      unit: m.unit,
      // the canonical "before" for the group - all measures in a group
      // share (goal, metric, unit) and MUST agree on `before`.
      before: m.before ?? null,
      beforeMismatch: false,
      deltaSum: 0,
      // confirmed / placed effects are aggregated as DELTAS off the
      // canonical before, never as a sum of absolute afters.
      confirmedDeltaSum: 0,
      placedDeltaSum: 0,
      hasConfirmed: false,
      hasPlaced: false,
      resourceIds: new Set(),
      count: 0,
      sources: new Set(),
      confidences: new Set(),
    };
    if (m.before != null) {
      if (g.before == null) g.before = m.before;
      else if (Math.abs(Number(g.before) - Number(m.before)) > 1e-6) g.beforeMismatch = true;
    }
    g.deltaSum += num(m.delta) ?? 0;
    // A measure only contributes a CONFIRMED (Solid) delta when its own
    // effectState is "confirmed" - a "placed" branch is still a Ghost.
    const isConfirmed = m.effectState === "confirmed" || (m.effectState == null && m.confirmedAfter != null);
    const isPlaced = m.effectState === "placed" || (m.effectState == null && m.placedAfter != null);
    if (isConfirmed) {
      const after = Number(m.confirmedAfter ?? m.placedAfter ?? m.possibleAfter);
      g.confirmedDeltaSum += after - Number(m.before ?? g.before ?? 0);
      g.hasConfirmed = true;
    }
    if (isConfirmed || isPlaced) {
      const after = Number(m.placedAfter ?? m.confirmedAfter ?? m.possibleAfter);
      g.placedDeltaSum += after - Number(m.before ?? g.before ?? 0);
      g.hasPlaced = true;
    }
    if (m.resourceId) g.resourceIds.add(m.resourceId);
    g.count += 1;
    if (m.sourceBranchId) g.sources.add(m.sourceBranchId);
    else if (m.sourcePlanId) g.sources.add(m.sourcePlanId);
    g.confidences.add(m.confidence);
    groups.set(k, g);
  }

  const aggregated = [...groups.values()].map((g) => {
    const round2 = (n) => Math.round(n * 100) / 100;
    // The state (and therefore the direction the customer acts on) is the
    // CONFIRMED delta once anything is solid, otherwise the possible one.
    const netDelta = g.hasConfirmed ? g.confirmedDeltaSum : g.deltaSum;
    const direction = directionFor({ metric: g.metric, delta: netDelta });
    const confirmedAfter = g.hasConfirmed && g.before != null ? round2(g.before + g.confirmedDeltaSum) : null;
    return {
      targetGoalId: g.targetGoalId,
      metric: g.metric,
      unit: g.unit, // stays explicit - callers must not merge across units
      before: g.before,
      beforeMismatch: g.beforeMismatch, // groups should never see this true
      possibleDelta: round2(g.deltaSum),
      possibleAfter: g.before != null ? round2(g.before + g.deltaSum) : null,
      confirmedDelta: g.hasConfirmed ? round2(g.confirmedDeltaSum) : null,
      confirmedAfter,
      placedDelta: g.hasPlaced ? round2(g.placedDeltaSum) : null,
      placedAfter: g.hasPlaced && g.before != null ? round2(g.before + g.placedDeltaSum) : null,
      state: g.hasConfirmed ? "solid" : "ghost",
      placement: g.hasConfirmed ? "confirmed" : g.hasPlaced ? "placed" : "possible",
      resourceIdCount: g.resourceIds.size,
      direction,
      favourable: favourableFor({ metric: g.metric, direction }),
      sourceCount: g.sources.size,
      confidence: g.confidences.has("low") ? "low" : g.confidences.has("medium") ? "medium" : "high",
    };
  });

  return { aggregated, invalid, groupCount: aggregated.length };
}

// A guard for any code path that is tempted to add numbers together:
// throws if the measures are not all the same unit.
export function assertHomogeneousUnit(measures = []) {
  const units = new Set(measures.map((m) => m?.unit));
  units.delete(undefined);
  if (units.size > 1) {
    throw new Error(`refusing to combine heterogeneous impact units: ${[...units].join(" + ")}`);
  }
  return units.size === 1 ? [...units][0] : null;
}
