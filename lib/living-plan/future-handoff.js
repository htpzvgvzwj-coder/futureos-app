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
// activeGoals: the customer's real active goal domains - the ONLY valid
//   destinations for the "goal" leg. The source goal is excluded unless it
//   is genuinely reopenable (reason "reduced", where it still exists).
// targetGoalId: the explicit destination the customer chose (or null =
//   Flexible). goalMonthly has NO meaning without it - it is never Home.
export function buildHandoffCandidate({ commitment, reason, reducedToMonthly = null, allocation = null, targetGoalId = null, activeGoals = [], jointConfirmationRequired = false, now = new Date() }) {
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

  // Real destinations: the customer's own active goals, minus the source
  // (unless it is genuinely reopenable), plus emergency + flexible which
  // are always valid. No target -> Flexible.
  const canReopenSource = reason === "reduced";
  const goalTargets = (Array.isArray(activeGoals) ? activeGoals : [])
    .filter((g) => g && g !== "flexible")
    .filter((g) => canReopenSource || g !== commitment.domain);
  const targets = Array.from(new Set([...goalTargets, "emergency", "flexible"]));

  return {
    fromCommitmentId: commitment.id,
    fromDomain: commitment.domain,
    reason,
    releasedMonthly: Math.round(releasedMonthly),
    unallocatedMonthly: Math.max(0, Math.round(releasedMonthly - allocated)),
    availableFromMonth: commitment.endMonth ?? commitment.effectiveMonth ?? now.toISOString().slice(0, 7),
    allocation: alloc,
    targetGoalId: targetGoalId && targets.includes(targetGoalId) ? targetGoalId : null,
    targets,
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
