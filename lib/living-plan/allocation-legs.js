// Per-leg allocation (Living Thread, causal-spine round).
//
// There is NO global `placed` boolean any more. A freed amount is placed
// leg by leg, and a goal's cross-goal effect becomes SOLID
// (`confirmedAfter`) only when THAT goal's leg received amount > 0.
//
// Accepts both the explicit shape { emergency, home, retirement, flexible,
// ... } and the legacy shape { goalMonthly, emergencyMonthly,
// flexibleMonthly } (+ allocationGoalId). Pure.

const KNOWN_GOALS = ["emergency", "home", "retirement", "flexible", "wedding", "family", "investment", "travel"];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// -> { emergency: 300, home: 0, ... } with only positive legs present.
export function allocationLegs(allocation, goalIdForGoalLeg = "home") {
  if (!allocation || typeof allocation !== "object") return {};
  const legs = {};
  const add = (goal, amt) => {
    const a = Math.round(num(amt));
    if (a > 0) legs[goal] = (legs[goal] ?? 0) + a;
  };

  // explicit per-goal shape
  for (const g of KNOWN_GOALS) if (g in allocation) add(g, allocation[g]);

  // legacy shape
  add("emergency", allocation.emergencyMonthly);
  add("flexible", allocation.flexibleMonthly);
  if (num(allocation.goalMonthly) > 0) {
    const g = typeof allocation.allocationGoalId === "string" && allocation.allocationGoalId ? allocation.allocationGoalId : goalIdForGoalLeg;
    add(g, allocation.goalMonthly);
  }

  return legs;
}

export function legConfirmed(legs, goalId) {
  return legs != null && legs[goalId] != null && legs[goalId] > 0;
}

export function totalAllocated(legs) {
  return Object.values(legs ?? {}).reduce((s, v) => s + num(v), 0);
}

// Build one affectedGoal entry with per-leg confirmation. `possibleAfter`
// is the ghost; `confirmedAfter` is `possibleAfter` ONLY if this goal's
// leg was funded. `direction` is derived from the delta, never from the
// sign of possibleAfter.
export function affectedGoalWithLegs({ goalId, metric, unit, before, possibleAfter, legs, confidence = "medium", provenance = "system_estimate", comparator = null }) {
  const b = before == null ? null : Number(before);
  const pa = possibleAfter == null ? null : Number(possibleAfter);
  const delta = b != null && pa != null ? pa - b : null;
  let direction = "flat";
  if (typeof comparator === "function") {
    direction = comparator(b, pa) || "flat";
  } else if (delta != null && Math.abs(delta) >= 1e-9) {
    direction = delta > 0 ? "up" : "down";
  }
  return {
    goalId,
    metric: metric ?? null,
    unit: unit ?? null,
    before: b,
    possibleAfter: pa,
    delta,
    confirmedAfter: legConfirmed(legs, goalId) ? pa : null,
    direction,
    confidence,
    provenance,
  };
}
