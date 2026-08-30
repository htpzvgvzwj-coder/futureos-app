// Living Scene Spine - the one phase machine every Studio scene runs on.
//
// The seven system behaviours are NOT seven panels. They are seven phases
// of a single spine that moves forward as the customer acts:
//
//   reality -> possible -> allocation -> turning_point -> committed
//           -> guardian -> memory
//
// Only the current phase's question and the behaviour(s) relevant to it are
// shown at any moment (LivingSpine renders the strip; the scene renders its
// own native surface above). This module is pure: no React, no fetch, no
// DOM - just "given this scene state, which phase are we in and what
// surfaces".

export const SCENE_PHASES = ["reality", "possible", "allocation", "turning_point", "committed", "guardian", "memory"];

// question key (locale) + which behaviours belong to this phase
export const PHASE_META = {
  reality: { questionKey: "livingScene.phase.reality", behaviours: [] },
  possible: { questionKey: "livingScene.phase.possible", behaviours: ["promise_weight"] },
  allocation: { questionKey: "livingScene.phase.allocation", behaviours: ["released_future"] },
  turning_point: { questionKey: "livingScene.phase.turningPoint", behaviours: ["turning_point", "decision_echo"] },
  committed: { questionKey: "livingScene.phase.committed", behaviours: [] },
  guardian: { questionKey: "livingScene.phase.guardian", behaviours: ["shadow_guardian"] },
  memory: { questionKey: "livingScene.phase.memory", behaviours: ["future_handoff", "memory_lens"] },
};

export function phaseIndex(phase) {
  const i = SCENE_PHASES.indexOf(phase);
  return i < 0 ? 0 : i;
}

// The single phase that is LIVE right now, from the scene's state.
//
// state = {
//   branchDirty:  boolean  - the customer has moved something off reality
//   freedCashflow: number  - monthly resource freed by the current branch
//   addedPressure: number  - new monthly cost the current branch introduces
//   allocationSet: boolean - the customer has said where freed / pressure goes
//   turningPoint:  object|null       - a live turning point for this scene
//   turningPointAcknowledged: boolean
//   sealed:        boolean  - the branch has been committed
//   guardianActive: boolean - Guardian is watching the committed path
//   revoked:       boolean  - the commitment was undone (back to reality)
// }
export function derivePhase(state = {}) {
  const s = state || {};
  if (s.revoked) return "reality";
  if (s.sealed) return s.guardianActive === false ? "memory" : "guardian";
  if (!s.branchDirty) return "reality";

  const resourceQuestion = (Number(s.freedCashflow) || 0) > 0 || (Number(s.addedPressure) || 0) > 0;
  if (resourceQuestion && !s.allocationSet) return "allocation";
  if (s.turningPoint && !s.turningPointAcknowledged) return "turning_point";
  return "possible";
}

// Behaviours that may surface for a given phase (never all seven at once).
export function visibleBehaviours(phase) {
  return PHASE_META[phase]?.behaviours ?? [];
}

// High-water mark: once a phase has been reached it stays "reached" so the
// scene can keep its earlier layers visible while the strip shows only the
// current question. Reality is always reached.
export function mergeReached(prevReached, currentPhase) {
  const prev = Array.isArray(prevReached) ? prevReached : ["reality"];
  const target = phaseIndex(currentPhase);
  const merged = new Set(prev);
  for (const p of SCENE_PHASES) {
    if (phaseIndex(p) <= target) merged.add(p);
  }
  merged.add("reality");
  return SCENE_PHASES.filter((p) => merged.has(p));
}

export function phaseReached(reached, phase) {
  return Array.isArray(reached) && reached.includes(phase);
}

// A short, honest description of what each phase is asking - used by the
// spine strip and by tests to assert the wording stays a question.
export const PHASE_PROMPTS = {
  reality: "What does the system know right now?",
  possible: "What could happen if this changes?",
  allocation: "Who carries the freed or added resource, and where does it go?",
  turning_point: "Why does this need a decision now?",
  committed: "What did you confirm?",
  guardian: "What is the system protecting?",
  memory: "Why did today turn out this way?",
};
