// Living Plan - Allocation model (pure, no DB/AI).
//
// When a change to one plan RELEASES monthly cashflow, that money does not
// automatically flow anywhere. It becomes an "Available Future" the
// customer allocates themselves:
//
//   Keep Flexible    -> stays as free cashflow
//   Accelerate <goal> -> a chosen amount goes to another active goal
//   Rebuild Safety   -> a chosen amount goes to the Emergency fund
//   Split            -> any combination, summing to the freed amount
//
// This module owns the shape and the arithmetic. It is domain-agnostic:
// the "goal" leg is generic so Home / Retirement / Loan / etc. can all use
// it, not just Wedding->Home.

// allocation shape:
//   { goalMonthly: number, emergencyMonthly: number, flexibleMonthly: number }
// (goalMonthly is the "accelerate another active goal" leg; the specific
//  goal id is carried on the branch/version alongside, not in here.)

export function emptyAllocation() {
  return { goalMonthly: 0, emergencyMonthly: 0, flexibleMonthly: 0 };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function normalizeAllocation(allocation) {
  const a = allocation ?? {};
  return {
    goalMonthly: num(a.goalMonthly),
    emergencyMonthly: num(a.emergencyMonthly),
    flexibleMonthly: num(a.flexibleMonthly),
  };
}

export function allocationSum(allocation) {
  const a = normalizeAllocation(allocation);
  return a.goalMonthly + a.emergencyMonthly + a.flexibleMonthly;
}

// Validate a proposed allocation against the freed amount. Returns
// { ok, error, allocation, unallocated }. An allocation that is set but
// under-allocates is still ok - the remainder is "unallocated / available";
// only OVER-allocating (more than was freed) is rejected.
export function validateAllocation({ freedCashflow, allocation }) {
  const freed = Number(freedCashflow);
  if (!Number.isFinite(freed) || freed <= 0) {
    return { ok: false, error: "nothing_freed", allocation: emptyAllocation(), unallocated: 0 };
  }
  const a = normalizeAllocation(allocation);
  const sum = a.goalMonthly + a.emergencyMonthly + a.flexibleMonthly;
  if (sum > freed + 0.5) {
    return { ok: false, error: "over_allocated", allocation: a, unallocated: 0, freed, sum };
  }
  return {
    ok: true,
    error: null,
    allocation: a,
    unallocated: Math.max(0, Math.round((freed - sum) * 100) / 100),
    freed,
    sum,
  };
}

export function isAllocationSet(allocation) {
  return allocationSum(allocation) > 0;
}

export function isFullyAllocated({ freedCashflow, allocation }) {
  const freed = Number(freedCashflow) || 0;
  return freed > 0 && allocationSum(allocation) >= freed - 0.5;
}

// A quick "all of it to one leg" helper the UI uses for the one-tap
// choices (Keep Flexible / Accelerate goal / Rebuild Safety).
export function allToLeg(leg, freedCashflow) {
  const freed = Math.max(0, Number(freedCashflow) || 0);
  const base = emptyAllocation();
  if (leg === "goal") base.goalMonthly = freed;
  else if (leg === "emergency") base.emergencyMonthly = freed;
  else base.flexibleMonthly = freed;
  return base;
}
