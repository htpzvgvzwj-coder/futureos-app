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

// Build one typed ImpactMeasure. Returns { valid: false, invalidReason }
// when the input cannot be trusted (rule 4). `delta` is computed from
// before/possibleAfter when omitted; `direction` is ALWAYS re-derived
// here from delta - any caller-supplied direction is ignored.
export function buildImpactMeasure(input = {}) {
  const {
    sourcePlanId = null,
    sourceBranchId = null,
    targetGoalId = null,
    metric = null,
    unit = null,
    before = null,
    possibleAfter = null,
    confirmedAfter = null,
    confidence = "medium",
    assumptions = [],
    provenance = "system_estimate",
    comparator = null,
  } = input;

  if (!targetGoalId) return { valid: false, invalidReason: "missing_targetGoalId" };
  if (!metric) return { valid: false, invalidReason: "missing_metric" };
  if (!isImpactUnit(unit)) return { valid: false, invalidReason: "missing_or_unknown_unit", unit: unit ?? null };

  const b = num(before);
  const pa = num(possibleAfter);
  let delta = num(input.delta);
  if (delta == null && b != null && pa != null) delta = pa - b;

  const direction = directionFor({ metric, before: b, after: pa, delta, comparator });
  const favourable = favourableFor({ metric, direction });

  return {
    valid: true,
    sourcePlanId,
    sourceBranchId,
    targetGoalId,
    metric,
    unit,
    before: b,
    delta,
    possibleAfter: pa,
    confirmedAfter: num(confirmedAfter),
    direction,
    favourable,
    confidence,
    assumptions: Array.isArray(assumptions) ? assumptions.map((a) => (typeof a === "string" ? { text: a } : a)) : [],
    provenance,
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
      before: m.before,
      deltaSum: 0,
      confirmedSum: 0,
      hasConfirmed: false,
      count: 0,
      sources: new Set(),
      confidences: new Set(),
    };
    g.deltaSum += num(m.delta) ?? 0;
    if (m.confirmedAfter != null) {
      g.confirmedSum += m.confirmedAfter;
      g.hasConfirmed = true;
    }
    g.count += 1;
    if (m.sourceBranchId) g.sources.add(m.sourceBranchId);
    else if (m.sourcePlanId) g.sources.add(m.sourcePlanId);
    g.confidences.add(m.confidence);
    groups.set(k, g);
  }

  const aggregated = [...groups.values()].map((g) => {
    const direction = directionFor({ metric: g.metric, delta: g.deltaSum });
    return {
      targetGoalId: g.targetGoalId,
      metric: g.metric,
      unit: g.unit, // stays explicit - callers must not merge across units
      before: g.before,
      possibleDelta: Math.round(g.deltaSum * 100) / 100,
      possibleAfter: g.before != null ? Math.round((g.before + g.deltaSum) * 100) / 100 : null,
      confirmedAfter: g.hasConfirmed ? Math.round(g.confirmedSum * 100) / 100 : null,
      state: g.hasConfirmed ? "solid" : "ghost",
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
