// Plan Runtime - the canonical plan lifecycle (pure, no DB/AI).
//
// One state graph for every goal in FutureOS, so "what stage is this plan
// at" and "is this transition allowed" have exactly one answer regardless
// of domain (home / wedding / retirement / ...). Every plan, branch and
// commitment carries a status from PLAN_STATES and only moves along an edge
// defined here.
//
//   discovery -> exploration -> simulation -> commitment -> shadow trial
//   -> execution/monitoring -> deviation -> rescue -> completion
//   -> next life stage
//
// mapped to concrete states:
//
//   draft        a goal exists, no worked plan yet (discovery/exploration)
//   shadow       running in Shadow Guardian - simulated, no real money
//   proposed     a worked plan is on the table, awaiting the customer
//   scheduled    the customer sealed it; arranged, but no real bank action yet
//   active       really executing (real transfers / real tracking)
//   paused       really held (Guardian pause, or customer hold)
//   needs_approval  a change is blocked pending a (joint) confirmation
//   rescued      a Plan Rescue fix was adopted after a deviation
//   completed    the goal outcome was reached
//   handed_over  completed AND transitioned into a follow-on goal
//   revoked      cancelled; this plan/commitment no longer applies

export const PLAN_STATES = [
  "draft",
  "shadow",
  "proposed",
  "scheduled",
  "active",
  "paused",
  "needs_approval",
  "rescued",
  "completed",
  "handed_over",
  "revoked",
];

// Which states represent something REAL (vs. only projected/simulated).
export const NON_REAL_STATES = new Set(["draft", "shadow", "proposed"]);
export function isRealState(state) {
  return PLAN_STATES.includes(state) && !NON_REAL_STATES.has(state);
}

// Terminal states - nothing leaves them except an explicit reopen, which is
// modelled as a NEW plan version that supersedes, not an edge.
export const TERMINAL_STATES = new Set(["handed_over", "revoked"]);

// Allowed transitions. Key = from-state, value = { toState: { actors } }.
// actors = who is permitted to drive that edge. "system" = a deterministic
// rule (e.g. buffer below floor -> pause); never an AI.
const TRANSITIONS = {
  draft: {
    shadow: { actors: ["user"] },
    proposed: { actors: ["user", "system"] },
    revoked: { actors: ["user", "system"] },
  },
  shadow: {
    proposed: { actors: ["user"] },
    draft: { actors: ["user"] },
    revoked: { actors: ["user", "system"] },
  },
  proposed: {
    scheduled: { actors: ["user"] }, // Seal
    needs_approval: { actors: ["user", "partner", "system"] }, // joint goal
    shadow: { actors: ["user"] },
    draft: { actors: ["user"] },
    revoked: { actors: ["user", "system"] },
  },
  needs_approval: {
    scheduled: { actors: ["user", "partner"] },
    proposed: { actors: ["user", "partner"] },
    revoked: { actors: ["user", "partner", "system"] },
  },
  scheduled: {
    active: { actors: ["system", "user"] }, // real execution begins
    paused: { actors: ["user", "guardian"] },
    needs_approval: { actors: ["user", "partner", "system"] },
    revoked: { actors: ["user"] },
  },
  active: {
    paused: { actors: ["user", "guardian", "system"] }, // Guardian pause / buffer floor
    rescued: { actors: ["user"] }, // a Plan Rescue fix adopted
    needs_approval: { actors: ["user", "partner", "system"] },
    completed: { actors: ["system", "user"] },
    revoked: { actors: ["user"] },
  },
  paused: {
    active: { actors: ["user", "guardian", "system"] }, // resume
    rescued: { actors: ["user"] },
    revoked: { actors: ["user"] },
  },
  rescued: {
    active: { actors: ["user", "system"] },
    paused: { actors: ["user", "guardian", "system"] },
    completed: { actors: ["system", "user"] },
    revoked: { actors: ["user"] },
  },
  completed: {
    handed_over: { actors: ["user", "system"] }, // Goal Metamorphosis
  },
  handed_over: {},
  revoked: {},
};

export function allowedTransitions(fromState) {
  return Object.keys(TRANSITIONS[fromState] ?? {});
}

// Can `actor` move a plan from `fromState` to `toState`?
export function canTransition(fromState, toState, actor) {
  if (!PLAN_STATES.includes(fromState) || !PLAN_STATES.includes(toState)) return false;
  const edge = TRANSITIONS[fromState]?.[toState];
  if (!edge) return false;
  if (!actor) return true; // permission check skipped
  return edge.actors.includes(actor);
}

// Throwing variant for use inside a route/store right before the write.
// Returns void on success; throws an Error with a typed .code otherwise.
export function assertTransition(fromState, toState, actor) {
  if (!PLAN_STATES.includes(toState)) {
    const e = new Error(`unknown_target_state:${toState}`);
    e.code = "UNKNOWN_STATE";
    throw e;
  }
  if (TERMINAL_STATES.has(fromState)) {
    const e = new Error(`plan_is_terminal:${fromState}`);
    e.code = "TERMINAL_STATE";
    throw e;
  }
  if (!canTransition(fromState, toState, null)) {
    const e = new Error(`illegal_transition:${fromState}->${toState}`);
    e.code = "ILLEGAL_TRANSITION";
    throw e;
  }
  if (actor && !canTransition(fromState, toState, actor)) {
    const e = new Error(`actor_not_permitted:${actor}:${fromState}->${toState}`);
    e.code = "ACTOR_NOT_PERMITTED";
    throw e;
  }
}

// Map a plan state to the Change Ledger truthfulness status it should
// record events under, so the two vocabularies never drift.
export function ledgerStatusForPlanState(state) {
  switch (state) {
    case "draft":
    case "proposed":
      return "projected";
    case "shadow":
      return "simulated";
    case "scheduled":
    case "needs_approval":
      return "scheduled";
    case "active":
    case "rescued":
      return "active";
    case "paused":
      return "paused";
    case "revoked":
      return "revoked";
    case "completed":
    case "handed_over":
      return "completed";
    default:
      return "projected";
  }
}
