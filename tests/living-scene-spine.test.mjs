import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENE_PHASES,
  PHASE_META,
  PHASE_PROMPTS,
  derivePhase,
  phaseIndex,
  visibleBehaviours,
  mergeReached,
  phaseReached,
} from "../lib/living-scene/spine.js";

test("the spine has exactly the seven phases in order", () => {
  assert.deepEqual(SCENE_PHASES, ["reality", "possible", "allocation", "turning_point", "committed", "guardian", "memory"]);
});

test("reality is the phase when nothing has moved", () => {
  assert.equal(derivePhase({}), "reality");
  assert.equal(derivePhase({ branchDirty: false }), "reality");
});

test("moving something with no resource question -> possible (ready to commit)", () => {
  assert.equal(derivePhase({ branchDirty: true }), "possible");
});

test("a branch that frees cashflow -> allocation, until the customer places it", () => {
  assert.equal(derivePhase({ branchDirty: true, freedCashflow: 300 }), "allocation");
  assert.equal(derivePhase({ branchDirty: true, freedCashflow: 300, allocationSet: true }), "possible");
});

test("a branch that adds monthly pressure also routes through allocation", () => {
  assert.equal(derivePhase({ branchDirty: true, addedPressure: 120 }), "allocation");
  assert.equal(derivePhase({ branchDirty: true, addedPressure: 120, allocationSet: true }), "possible");
});

test("a live turning point interrupts before commit, once resources are settled", () => {
  assert.equal(
    derivePhase({ branchDirty: true, freedCashflow: 300, allocationSet: true, turningPoint: { id: "x" } }),
    "turning_point",
  );
  assert.equal(
    derivePhase({ branchDirty: true, freedCashflow: 300, allocationSet: true, turningPoint: { id: "x" }, turningPointAcknowledged: true }),
    "possible",
  );
});

test("after seal: guardian while it watches, memory once it stands down", () => {
  assert.equal(derivePhase({ sealed: true, guardianActive: true }), "guardian");
  assert.equal(derivePhase({ sealed: true, guardianActive: false }), "memory");
});

test("revoke returns the scene to reality", () => {
  assert.equal(derivePhase({ branchDirty: true, sealed: true, guardianActive: true, revoked: true }), "reality");
});

test("each phase surfaces at most its own behaviours - never all seven", () => {
  const everBehaviour = new Set();
  for (const p of SCENE_PHASES) {
    const b = visibleBehaviours(p);
    assert.ok(Array.isArray(b));
    assert.ok(b.length <= 2, `${p} shows <= 2 behaviours`);
    b.forEach((x) => everBehaviour.add(x));
  }
  // all seven behaviours are covered across the spine, just never at once
  assert.deepEqual(
    [...everBehaviour].sort(),
    ["decision_echo", "future_handoff", "memory_lens", "promise_weight", "released_future", "shadow_guardian", "turning_point"],
  );
});

test("mergeReached is a high-water mark that always includes reality", () => {
  assert.deepEqual(mergeReached(["reality"], "reality"), ["reality"]);
  const r = mergeReached(["reality"], "allocation");
  assert.deepEqual(r, ["reality", "possible", "allocation"]);
  // going back to an earlier phase does not lose the reached ones
  const back = mergeReached(r, "possible");
  assert.deepEqual(back, ["reality", "possible", "allocation"]);
  assert.ok(phaseReached(back, "allocation"));
  assert.ok(!phaseReached(back, "guardian"));
});

test("every phase has a locale question key and a plain-language prompt that is a question", () => {
  for (const p of SCENE_PHASES) {
    assert.ok(PHASE_META[p]?.questionKey?.startsWith("livingScene.phase."));
    assert.ok(PHASE_PROMPTS[p].endsWith("?"), `${p} prompt is a question`);
  }
});

test("phaseIndex is monotonic along SCENE_PHASES", () => {
  for (let i = 1; i < SCENE_PHASES.length; i++) {
    assert.ok(phaseIndex(SCENE_PHASES[i]) > phaseIndex(SCENE_PHASES[i - 1]));
  }
  assert.equal(phaseIndex("nonsense"), 0);
});
