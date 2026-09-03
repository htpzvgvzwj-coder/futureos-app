// Guardian Phase 4 — deriveLifeStage. Stage comes from what we know
// (supervision, live plans, safety floor, drawdown), never a guessed age.

import test from "node:test";
import assert from "node:assert/strict";
import { deriveLifeStage } from "../lib/guardian/lifecycle.js";

const commit = (domain, monthlyContribution = 300) => ({ domain, monthlyContribution, status: "active" });

test("no plans, nothing known -> unknown stage", () => {
  const s = deriveLifeStage({});
  assert.equal(s.id, "unknown");
  assert.equal(s.alsoCaregiver, false);
});

test("supervised by someone -> supported, whatever the plans", () => {
  const s = deriveLifeStage({ supervisedByOthers: 1, commitments: [commit("home", 700)] });
  assert.equal(s.id, "supported");
});

test("below the safety floor -> recovering wins over plan mix", () => {
  const s = deriveLifeStage({ belowSafetyFloor: true, commitments: [commit("home", 700), commit("wedding", 500)] });
  assert.equal(s.id, "recovering");
});

test("home or wedding commitment -> family", () => {
  assert.equal(deriveLifeStage({ commitments: [commit("home", 700)] }).id, "family");
  assert.equal(deriveLifeStage({ commitments: [commit("wedding", 500)] }).id, "family");
});

test("two non-family plans -> building", () => {
  const s = deriveLifeStage({ commitments: [commit("investment", 400), commit("retirement", 300)] });
  assert.equal(s.id, "building");
});

test("one lone non-family plan -> establishing", () => {
  assert.equal(deriveLifeStage({ commitments: [commit("investment", 200)] }).id, "establishing");
});

test("retirement drawdown -> retirement", () => {
  assert.equal(deriveLifeStage({ retirementDrawdown: true, commitments: [] }).id, "retirement");
});

test("caregiver flag rides on top of the base stage", () => {
  const s = deriveLifeStage({ iSupervise: 2, commitments: [commit("investment", 200)] });
  assert.equal(s.alsoCaregiver, true);
  assert.match(s.caregiverNote, /2 accounts/);
  // supervising someone counts as family responsibility
  assert.equal(s.id, "family");
});

test("zero-dollar commitments don't count", () => {
  const s = deriveLifeStage({ commitments: [{ domain: "home", monthlyContribution: 0, status: "active" }] });
  assert.equal(s.id, "unknown");
});

test("every stage carries focus + why", () => {
  for (const inp of [{}, { supervisedByOthers: 1 }, { belowSafetyFloor: true }, { retirementDrawdown: true }, { commitments: [commit("home")] }, { commitments: [commit("investment"), commit("retirement")] }, { commitments: [commit("investment")] }]) {
    const s = deriveLifeStage(inp);
    assert.ok(s.focus && s.why && s.label, `${s.id} missing copy`);
  }
});
