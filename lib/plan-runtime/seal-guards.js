// Server-authoritative Seal guards (Living Thread, causal-spine round).
// Pure - the seal route composes these before it touches the DB.

const UNSEALABLE_BRANCH_STATUS = new Set(["discarded", "merged", "sealed", "withdrawn"]);

// Decide whether a branch may be sealed against the current plan state.
// Returns { ok: true } or { ok: false, error, status, detail }.
export function checkSealBranch({ branch, planId, currentPlanVersion }) {
  if (!branch) return { ok: true }; // sealing the reality path
  if (UNSEALABLE_BRANCH_STATUS.has(branch.status)) {
    return { ok: false, error: "branch_not_sealable", status: 409, detail: { branchStatus: branch.status } };
  }
  if (planId != null && branch.plan_id != null && branch.plan_id !== planId) {
    return { ok: false, error: "branch_plan_mismatch", status: 409, detail: {} };
  }
  const base = branch.base_version;
  const cur = currentPlanVersion;
  if (base != null && cur != null && String(base) !== String(cur)) {
    return {
      ok: false,
      error: "stale_branch",
      status: 409,
      detail: {
        branchBaseVersion: String(base),
        currentPlanVersion: String(cur),
        hint: "the plan moved on since this branch was peeled - re-peel from the current version before sealing",
      },
    };
  }
  return { ok: true };
}

// The freed / added-pressure a Seal is allowed to act on come ONLY from a
// server-side re-projection of the locked branch. This normalises whatever
// the adapter returned; the client's numbers are never passed in here.
export function serverResourceDelta(impact) {
  const rd = impact?.resourceDelta ?? {};
  return {
    freedCashflow: Math.max(0, Math.round(Number(rd.freedMonthly ?? impact?.freedCashflow ?? 0)) || 0),
    addedPressure: Math.max(0, Math.round(Number(rd.addedPressureMonthly ?? 0)) || 0),
  };
}
