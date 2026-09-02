// The ONE Current Moment (Living Thread, causal-spine round).
//
// Five explicit outcomes. A plan drives the global Life Thread through
// EXACTLY ONE of them:
//   reality       - no branches; the confirmed reality path
//   activeBranch  - the single `active` branch (its effect is a GHOST)
//   sealedBranch  - a sealed commitment; its effect is SOLID reality
//   alternatives  - open branches nobody activated; compare only, moves
//                   nothing
//   conflict      - MORE THAN ONE `active` branch: an invalid state; the
//                   plan drives nothing until it is resolved. Never
//                   silently pick the first one.
//
// Pure.

export const MOMENT_STATES = ["reality", "activeBranch", "alternatives", "sealedBranch", "conflict"];

const OPEN_STATUSES = new Set(["open", "active"]);

// branches: plan_branches rows ({ id, status, ... }).
// sealedCommitment: an active goal_commitments row for this plan, or null.
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
  const actives = open.filter((b) => b.status === "active");

  // Invalid: the DB should hold at most one active branch per plan
  // (enforced by a partial unique index). If the read still shows more,
  // do NOT choose - report the conflict.
  if (actives.length > 1) {
    return {
      state: "conflict",
      branchId: null,
      commitmentId: null,
      activeBranchIds: actives.map((b) => b.id),
      alternativeBranchIds: open.filter((b) => b.status !== "active").map((b) => b.id),
      drivesLifeThread: false,
    };
  }

  const active = actives[0] ?? (open.length === 1 ? open[0] : null);
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

// The branch id the canonical Life Thread projects against for this plan.
//   activeBranch  -> the active branch (GHOST overlay)
//   sealedBranch  -> the sealed branch (SOLID, projected vs its prior reality)
//   reality / alternatives / conflict -> null (no branch drives the thread)
export function impactSourceBranchId(moment) {
  if (!moment) return null;
  if (moment.state === "activeBranch" || moment.state === "sealedBranch") return moment.branchId;
  return null;
}

export function momentDrivesLifeThread(moment) {
  return Boolean(moment?.drivesLifeThread);
}
