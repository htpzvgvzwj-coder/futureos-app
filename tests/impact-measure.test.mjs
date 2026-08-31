import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImpactMeasure,
  validateImpactMeasure,
  aggregateImpactMeasures,
  assertHomogeneousUnit,
  directionFor,
  IMPACT_UNITS,
} from "../lib/living-plan/impact-measure.js";

// ---- the exact regressions from the causal-spine spec ------------------

test("Emergency 6 -> 5 buffer months is DOWN (the metric value fell)", () => {
  const m = buildImpactMeasure({
    targetGoalId: "emergency",
    metric: "emergencyBufferMonths",
    unit: "months",
    before: 6,
    possibleAfter: 5,
  });
  assert.equal(m.valid, true);
  assert.equal(m.delta, -1);
  assert.equal(m.direction, "down");
  assert.equal(m.unit, "months");
  // and it is UN-favourable (a smaller buffer is worse)
  assert.equal(m.favourable, false);
});

test("before=100, after=80 -> direction from delta=-20, never from possibleAfter sign", () => {
  const m = buildImpactMeasure({ targetGoalId: "home", metric: "monthlyRoom", unit: "sgd_per_month", before: 100, possibleAfter: 80 });
  assert.equal(m.delta, -20);
  assert.equal(m.direction, "down");
});

test("a NEGATIVE possibleAfter with a POSITIVE delta is UP - the sign of possibleAfter is irrelevant", () => {
  // room was -100/mo, becomes -40/mo: it improved by +60.
  const m = buildImpactMeasure({ targetGoalId: "home", metric: "monthlyRoom", unit: "sgd_per_month", before: -100, possibleAfter: -40 });
  assert.equal(m.delta, 60);
  assert.equal(m.direction, "up", "delta-driven, not possibleAfter-sign-driven");
});

test("SGD and months are NEVER aggregated together - they land in separate groups", () => {
  const sgd = buildImpactMeasure({ targetGoalId: "home", metric: "monthlyRoom", unit: "sgd_per_month", before: 0, possibleAfter: -200, sourceBranchId: "b1" });
  const months = buildImpactMeasure({ targetGoalId: "home", metric: "monthsOfBufferForegone", unit: "months", before: 0, possibleAfter: 1.4, sourceBranchId: "b1" });
  const { aggregated } = aggregateImpactMeasures([sgd, months]);
  assert.equal(aggregated.length, 2, "one group per (goal, metric, unit)");
  const units = aggregated.map((g) => g.unit).sort();
  assert.deepEqual(units, ["months", "sgd_per_month"]);
  // and there is no cross-group total
  assert.equal(aggregated.some((g) => g.metric === "total" || g.unit === "mixed"), false);
});

test("assertHomogeneousUnit throws when a caller tries to combine heterogeneous units", () => {
  assert.throws(
    () => assertHomogeneousUnit([{ unit: "sgd_per_month" }, { unit: "months" }]),
    /heterogeneous impact units/,
  );
  assert.doesNotThrow(() => assertHomogeneousUnit([{ unit: "sgd_per_month" }, { unit: "sgd_per_month" }]));
});

test("a measure with no unit (or an unknown unit) is INVALID, never coerced", () => {
  const noUnit = buildImpactMeasure({ targetGoalId: "home", metric: "monthlyRoom", before: 0, possibleAfter: -100 });
  assert.equal(noUnit.valid, false);
  assert.equal(noUnit.invalidReason, "missing_or_unknown_unit");

  const badUnit = buildImpactMeasure({ targetGoalId: "home", metric: "monthlyRoom", unit: "dollars", before: 0, possibleAfter: -100 });
  assert.equal(badUnit.valid, false);

  const { invalid, aggregated } = aggregateImpactMeasures([noUnit, badUnit]);
  assert.equal(invalid.length, 2);
  assert.equal(aggregated.length, 0, "invalid measures never reach a group");
});

test("confirmed aggregation is DELTA-based - absolute confirmedAfter values are never summed", () => {
  const before = 1000;
  const a = buildImpactMeasure({ targetGoalId: "safety", metric: "monthlyRoom", unit: "sgd_per_month", before, possibleAfter: 900, confirmedAfter: 900, sourceBranchId: "A" });
  const b = buildImpactMeasure({ targetGoalId: "safety", metric: "monthlyRoom", unit: "sgd_per_month", before, possibleAfter: 800, confirmedAfter: 800, sourceBranchId: "B" });
  const { aggregated } = aggregateImpactMeasures([a, b]);
  assert.equal(aggregated.length, 1);
  const g = aggregated[0];
  // 1000 + (900-1000) + (800-1000) = 1000 - 100 - 200 = 700  (NOT 1700)
  assert.equal(g.confirmedAfter, 700);
  assert.equal(g.confirmedDelta, -300);
  assert.equal(g.state, "solid");
  assert.equal(g.direction, "down", "the net confirmed delta is negative");
  assert.equal(g.beforeMismatch, false, "both sources agree on the canonical before");
});

test("a ghost + a solid source in one group: state is solid, direction from the confirmed delta", () => {
  const ghost = buildImpactMeasure({ targetGoalId: "safety", metric: "monthlyRoom", unit: "sgd_per_month", before: 1000, possibleAfter: 1200 });
  const solid = buildImpactMeasure({ targetGoalId: "safety", metric: "monthlyRoom", unit: "sgd_per_month", before: 1000, possibleAfter: 900, confirmedAfter: 900 });
  const { aggregated } = aggregateImpactMeasures([ghost, solid]);
  assert.equal(aggregated[0].state, "solid");
  assert.equal(aggregated[0].confirmedAfter, 900);
  assert.equal(aggregated[0].possibleAfter, 1100, "the possible layer still shows both deltas");
});

test("aggregation sums deltas ONLY within a (goal, metric, unit) group", () => {
  const a = buildImpactMeasure({ targetGoalId: "safety", metric: "monthlyRoom", unit: "sgd_per_month", before: 0, possibleAfter: -100, sourceBranchId: "loan" });
  const b = buildImpactMeasure({ targetGoalId: "safety", metric: "monthlyRoom", unit: "sgd_per_month", before: 0, possibleAfter: -80, sourceBranchId: "travel" });
  const c = buildImpactMeasure({ targetGoalId: "safety", metric: "emergencyBufferMonths", unit: "months", before: 6, possibleAfter: 5.2, sourceBranchId: "loan" });
  const { aggregated } = aggregateImpactMeasures([a, b, c]);
  const room = aggregated.find((g) => g.metric === "monthlyRoom");
  const months = aggregated.find((g) => g.metric === "emergencyBufferMonths");
  assert.equal(room.possibleDelta, -180, "the two sgd_per_month deltas sum");
  assert.equal(room.sourceCount, 2);
  assert.equal(months.possibleDelta, -0.8, "the months delta is its own group");
});

test("directionFor is delta-sign only; a comparator overrides for non-numeric metrics", () => {
  assert.equal(directionFor({ metric: "x", delta: 5 }), "up");
  assert.equal(directionFor({ metric: "x", delta: -5 }), "down");
  assert.equal(directionFor({ metric: "x", delta: 0 }), "flat");
  assert.equal(directionFor({ metric: "x", before: 10, after: 3 }), "down");
  assert.equal(
    directionFor({ metric: "readyDate", before: "2028-06", after: "2027-06", comparator: (b, a) => (a < b ? "down" : a > b ? "up" : "flat") }),
    "down",
  );
});

test("validateImpactMeasure rejects a bad direction / missing unit", () => {
  assert.equal(validateImpactMeasure({ valid: true, targetGoalId: "home", metric: "m", unit: "sgd", direction: "sideways" }).ok, false);
  assert.equal(validateImpactMeasure({ valid: true, targetGoalId: "home", metric: "m", direction: "up" }).ok, false);
  assert.equal(validateImpactMeasure({ valid: true, targetGoalId: "home", metric: "m", unit: "months", direction: "up" }).ok, true);
});

test("the unit vocabulary is closed and explicit", () => {
  assert.deepEqual([...IMPACT_UNITS].sort(), ["count", "date_shift_months", "months", "percentage", "sgd", "sgd_per_month"]);
});
