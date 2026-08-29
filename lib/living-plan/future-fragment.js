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
