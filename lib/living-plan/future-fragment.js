// Living Plan - Future Fragment (pure, no DB/AI).
//
// When a real decision RELEASES a resource (monthly cashflow, an earmarked
// sum no longer needed, a time window, freed commitment capacity), FutureOS
// creates a Future Fragment: a new piece of choice the customer owns and
// must place themselves. It is never auto-allocated.
//
// A Fragment is a projection over (a Change Ledger event + a plan branch +
// its allocation), not its own source of truth - reconstructable, cached
// only for convenience.
//
//   unclaimed  - the resource exists, nothing chosen yet
//   allocated  - the customer set an allocation (branch data.allocation)
//   committed  - the branch was Sealed; the allocation rides on the commitment
//   revoked    - the Seal was revoked; the Fragment returns to the prior state
//   handed_off - the releasing plan completed and its resource became a Handoff
//   expired    - a time-boxed Fragment passed its usable date

import { normalizeAllocation, allocationSum } from "./allocation.js";

export const FRAGMENT_STATES = ["unclaimed", "allocated", "committed", "revoked", "handed_off", "expired"];

export const FRAGMENT_RESOURCE_KINDS = [
  "monthly_cashflow",
  "earmarked_sum",
  "time_window",
  "commitment_capacity",
  "safety_headroom",
];

// Derive a Fragment view from a branch + its projected impact.
// branch: { id, label, data: { allocation? }, status }
// projectedImpacts: adapter.projectImpacts output (has mode, freedCashflow,
//   availableImpact, allocatedImpact)
export function deriveFutureFragment({ branch, projectedImpacts, sealedCommitment = null, now = new Date() }) {
  if (!projectedImpacts || projectedImpacts.mode !== "freed" || !(projectedImpacts.freedCashflow > 0)) {
    return null; // no released resource -> no Fragment (a costlier branch has "pressure", handled elsewhere)
  }
  const allocation = normalizeAllocation(branch?.data?.allocation);
  const allocated = allocationSum(allocation);
  const freed = Number(projectedImpacts.freedCashflow) || 0;

  let state = "unclaimed";
  if (sealedCommitment && sealedCommitment.status === "active") state = "committed";
  else if (sealedCommitment && sealedCommitment.status === "revoked") state = "revoked";
  else if (branch?.status === "sealed") state = "committed";
  else if (allocated > 0) state = "allocated";

  const validUntil = branch?.data?.fragment_valid_until ?? null;
  if (state === "unclaimed" && validUntil && new Date(validUntil) <= now) state = "expired";

  return {
    branchId: branch?.id ?? null,
    resourceKind: "monthly_cashflow",
    amountMonthly: Math.round(freed),
    unallocatedMonthly: Math.max(0, Math.round(freed - allocated)),
    allocation,
    state,
    availableImpact: projectedImpacts.availableImpact ?? null,
    allocatedImpact: projectedImpacts.allocatedImpact ?? null,
    validUntil,
  };
}

export function fragmentIsActionable(fragment) {
  return fragment && (fragment.state === "unclaimed" || fragment.state === "allocated");
}

// ---- Future Fragment V2 (causal-spine state machine) ------------------
//
// The canonical lifecycle the Living Thread renders:
//
//   possible  - a resource exists (freed cashflow / freed pressure) and the
//               customer has chosen no destination for it yet. Ghost.
//   placed    - the customer routed some / all of it to real legs, but has
//               NOT sealed. Still Ghost - nothing has moved.
//   sealed    - the releasing branch was Sealed. The placed legs are now
//               Solid; any unplaced remainder sits in the flexible pool.
//   released  - the releasing plan itself completed; the resource became a
//               standing Handoff.
//   revoked   - the Seal was revoked; the Fragment falls back to its prior
//               (pre-seal) state.
//   expired   - a time-boxed Fragment passed its usable date without a Seal.
//
// Pure projection over (branch + allocation + seal + now). No DB / AI.
export const FRAGMENT_STATES_V2 = ["possible", "placed", "sealed", "released", "revoked", "expired"];

export function deriveFutureFragmentV2({
  branch = null,
  freedMonthly = 0,
  addedPressureMonthly = 0,
  allocation = null,
  sealedCommitment = null,
  planCompleted = false,
  now = new Date(),
} = {}) {
  const freed = Math.max(0, Math.round(Number(freedMonthly) || 0));
  const pressure = Math.max(0, Math.round(Number(addedPressureMonthly) || 0));
  if (freed === 0 && pressure === 0) return null; // nothing released -> no Fragment

  const kind = pressure > 0 ? "commitment_capacity" : "monthly_cashflow";
  const total = pressure > 0 ? pressure : freed;
  const alloc = normalizeAllocation(allocation);
  const placedSum = Math.min(total, allocationSum(alloc));

  const sealActive = sealedCommitment?.status === "active" || branch?.status === "sealed";
  const sealRevoked = sealedCommitment?.status === "revoked";

  let state;
  if (sealRevoked) state = "revoked";
  else if (planCompleted) state = "released";
  else if (sealActive) state = "sealed";
  else if (placedSum > 0) state = "placed";
  else state = "possible";

  const validUntil = branch?.data?.fragment_valid_until ?? null;
  if (state === "possible" && validUntil && new Date(validUntil) <= now) state = "expired";

  return {
    branchId: branch?.id ?? null,
    commitmentId: sealedCommitment?.id ?? null,
    resourceKind: kind,
    state,
    totalMonthly: total,
    placedMonthly: state === "possible" || state === "expired" ? 0 : placedSum,
    // once sealed, the placed legs are Solid and the remainder is flexible;
    // before Seal nothing is Solid.
    confirmedMonthly: state === "sealed" || state === "released" ? placedSum : 0,
    unplacedMonthly: Math.max(0, total - (state === "possible" || state === "expired" ? 0 : placedSum)),
    allocation: alloc,
    isGhost: state === "possible" || state === "placed" || state === "expired",
    isActionable: state === "possible" || state === "placed",
    validUntil,
  };
}
