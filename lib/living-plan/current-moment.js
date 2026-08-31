// The ONE Current Moment (Living Thread, causal-spine round).
//
// Four explicit states. Only `reality` (incl. a sealed branch, which IS
// reality now) and a single `activeBranch` are allowed to drive the
// global Life Thread. Multiple `alternatives` (open branches nobody has
// activated) exist only to be compared - they never move Today, Life,
// Guardian or another Studio.
//
// Pure.

export const MOMENT_STATES = ["reality", "activeBranch", "alternatives", "sealedBranch"];

const OPEN_STATUSES = new Set(["open", "active"]);

// branches: plan_branches rows ({ id, status, ... }).
// sealedCommitment: an active goal_commitments row for this plan, or null.
// A branch is "active" when its status is "active" (exactly one per plan)
// or when it is the only open branch.
export function resolveCurrentMoment({ branches = [], sealedCommitment = null } = {}) {
  if (sealedCommitment) {
    return {
      state: "sealedBranch",
      branchId: sealedCommitment.plan_branch_id ?? sealedCommitment.branchId ?? null,
      commitmentId: sealedCommitment.id ?? null,
      alternativeBranchIds: [],
      drivesLifeThread: true, // a sealed branch is reality now
    };
  }

  const open = branches.filter((b) => OPEN_STATUSES.has(b.status));
  const active = open.find((b) => b.status === "active") ?? (open.length === 1 ? open[0] : null);

  if (active) {
    return {
      state: "activeBranch",
      branchId: active.id,
      commitmentId: null,
      alternativeBranchIds: open.filter((b) => b.id !== active.id).map((b) => b.id),
      drivesLifeThread: true,
    };
  }

  if (open.length === 0) {
    return { state: "reality", branchId: null, commitmentId: null, alternativeBranchIds: [], drivesLifeThread: true };
  }

  // open branches exist but none is activated -> comparison only.
  return {
    state: "alternatives",
    branchId: null,
    commitmentId: null,
    alternativeBranchIds: open.map((b) => b.id),
    drivesLifeThread: false,
  };
}

// The branch id `collectStudioImpacts` / the canonical Life Thread is
// allowed to read for this plan. `null` = read reality only.
export function impactSourceBranchId(moment) {
  if (!moment) return null;
  if (moment.state === "activeBranch") return moment.branchId;
  // reality / sealedBranch -> reality (no branch overlay); alternatives ->
  // nothing drives the thread.
  return null;
}

// Does this moment allow a Studio branch to move OTHER Studios / the
// global surfaces?
export function momentDrivesLifeThread(moment) {
  return Boolean(moment?.drivesLifeThread);
}
