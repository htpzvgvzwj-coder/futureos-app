// Living Plan - Future Handoff (pure, no DB/AI).
//
// When a Living Plan completes, is revoked, or is materially reduced, the
// resource it used does not vanish and is NOT auto-redirected. It becomes a
// Handoff Candidate the customer places, using the same Allocation model as
// a Future Fragment.
//
// Only REAL committed resource is released - never the resource of a merely
// possible plan.

import { normalizeAllocation, allocationSum } from "./allocation.js";

export const HANDOFF_STATES = ["candidate", "allocated", "confirmed", "deferred", "dismissed"];

// commitment: { id, domain, monthlyContribution, status, effectiveMonth,
//   endMonth?, source_moment? }
// reason: "completed" | "revoked" | "reduced"
// reducedToMonthly: for reason "reduced", the new monthly amount
export function buildHandoffCandidate({ commitment, reason, reducedToMonthly = null, allocation = null, jointConfirmationRequired = false, now = new Date() }) {
  if (!commitment || commitment.status !== "active") {
    // only a real, currently-active (or just-active) commitment releases resource
    if (!(commitment && (reason === "completed" || reason === "revoked"))) return null;
  }
  const wasMonthly = Number(commitment.monthly_contribution ?? commitment.monthlyContribution) || 0;
  let releasedMonthly = 0;
  if (reason === "completed" || reason === "revoked") releasedMonthly = wasMonthly;
  else if (reason === "reduced") releasedMonthly = Math.max(0, wasMonthly - Number(reducedToMonthly || 0));
  if (releasedMonthly <= 0) return null;

  const alloc = normalizeAllocation(allocation);
  const allocated = allocationSum(alloc);

  let state = "candidate";
  if (allocated >= releasedMonthly - 0.5) state = "allocated";
  else if (allocated > 0) state = "allocated";

  return {
    fromCommitmentId: commitment.id,
    fromDomain: commitment.domain,
    reason,
    releasedMonthly: Math.round(releasedMonthly),
    unallocatedMonthly: Math.max(0, Math.round(releasedMonthly - allocated)),
    availableFromMonth: commitment.endMonth ?? commitment.effectiveMonth ?? now.toISOString().slice(0, 7),
    allocation: alloc,
    // Where the freed monthly can go (generic - the caller filters to the
    // customer's own active goals).
    targets: ["home", "emergency", "retirement", "travel", "investment", "flexible"],
    jointConfirmationRequired: Boolean(jointConfirmationRequired),
    state,
    evidence: {
      priorMonthly: Math.round(wasMonthly),
      sourceMoment: commitment.source_moment ?? null,
      basis: "released from a real sealed commitment",
    },
  };
}

// A completed/revoked/reduced commitment must not silently change other
// goals until the customer confirms the Handoff.
export function handoffAffectsOtherGoals(handoff) {
  return handoff != null && handoff.state === "confirmed" && allocationSum(handoff.allocation) > 0;
}
