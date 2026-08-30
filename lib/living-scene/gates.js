// Pure gates for the Living Scene runtime. No React, no fetch - just the
// rules that decide when a commitment may be reviewed and where an
// allocation is allowed to go. Kept here so they are unit-testable
// independently of the provider.

// Commitment review must not render or execute until EVERY gate is clear:
//   - the customer has actually changed something (branchDirty)
//   - it is not already sealed
//   - any freed / added resource has a settled allocation
//   - a live turning point has been acknowledged
//   - the server branch exists
//   - that branch is sealable
export function commitmentGateOpen({
  branchDirty = false,
  sealed = false,
  allocationSettled = false,
  turningPoint = null,
  turningPointAck = false,
  serverBranchId = null,
  branchSealable = false,
} = {}) {
  if (!branchDirty) return false;
  if (sealed) return false;
  if (!allocationSettled) return false;
  if (turningPoint && !turningPointAck) return false;
  if (!serverBranchId) return false;
  if (!branchSealable) return false;
  return true;
}

// The goal id an allocation's "goal" leg is sent to. It is ONLY ever the
// customer's explicit target. There is no default - a "goal" leg with no
// target is invalid (the money stays flexible/unallocated instead).
// Returns { goalId, valid }.
export function allocationGoalId({ allocation = {}, allocationTarget = null } = {}) {
  const goal = Number(allocation.goalMonthly) || 0;
  const emergency = Number(allocation.emergencyMonthly) || 0;
  if (goal > 0) {
    if (!allocationTarget) return { goalId: null, valid: false };
    return { goalId: allocationTarget, valid: true };
  }
  if (emergency > 0) return { goalId: "emergency", valid: true };
  return { goalId: "flexible", valid: true };
}

// Is the allocation the customer set actually usable (no unpicked target)?
export function allocationSettled({ resourceQuestion = false, allocationTouched = false, overspent = false, allocation = {}, allocationTarget = null } = {}) {
  if (!resourceQuestion) return true;
  if (!allocationTouched || overspent) return false;
  if ((Number(allocation.goalMonthly) || 0) > 0 && !allocationTarget) return false;
  return true;
}
