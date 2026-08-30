import test from "node:test";
import assert from "node:assert/strict";
import {
  STUDIO_CONTRACT_KEYS,
  STUDIO_RESPONSE_KEYS,
  PROVENANCE_KINDS,
  BEHAVIOUR_SPINE,
  FLAGSHIP_CRITERIA,
  isProvenance,
  referenceEstimate,
  buildImpactSet,
  validateImpactSet,
  validateStudioResponse,
  assessStudio,
} from "../lib/living-plan/studio-contract.js";
import { getStudioContract, wiredContractSlots, livingPlanDomains } from "../lib/living-plan/registry.js";

test("the contract has exactly the eleven slots from Part B", () => {
  assert.deepEqual(STUDIO_CONTRACT_KEYS, [
    "realityLoader",
    "nativeScene",
    "branchVariables",
    "financeProjector",
    "crossGoalProjector",
    "constraintKinds",
    "turningPointRules",
    "guardianRules",
    "replayMapper",
    "provenanceRules",
    "unknownRules",
  ]);
});

test("provenance vocabulary is exactly the four kinds; nothing else validates", () => {
  assert.deepEqual(PROVENANCE_KINDS, ["bank_confirmed", "user_confirmed", "system_estimate", "unknown"]);
  assert.ok(isProvenance("bank_confirmed"));
  assert.ok(!isProvenance("demo"));
  assert.ok(!isProvenance("prototype"));
  assert.ok(!isProvenance(0));
});

test("referenceEstimate demands as-of + region and never says quote/approval/demo/prototype", () => {
  assert.throws(() => referenceEstimate({ value: 100 }), /asOf and region/);
  const e = referenceEstimate({ value: 1200, low: 900, high: 1600, asOf: "2026-06", region: "Singapore" });
  assert.equal(e.provenance, "system_estimate");
  assert.deepEqual(e.range, { low: 900, high: 1600 });
  assert.ok(!/demo|prototype/i.test(e.note));
  assert.ok(/not a quote/i.test(e.note), "it explicitly disclaims being a quote/approval");
});

test("the behaviour spine is one shared ordered sequence", () => {
  assert.deepEqual(BEHAVIOUR_SPINE, [
    "reality", "manipulate", "branch", "decision_ripple", "allocation", "turning_point", "seal", "guardian", "memory",
  ]);
});

test("buildImpactSet keeps possible/confirmed separate and clamps the server resource delta", () => {
  const is = buildImpactSet({
    cause: "guest_count 150->90",
    resourceDelta: { freedMonthly: 220.6, addedPressureMonthly: -5 },
    affectedGoals: [
      { goalId: "home", metric: "readyMonth", before: "2028-09", possibleAfter: "2028-05", direction: "up", provenance: "system_estimate" },
      { goalId: "emergency", metric: "bufferMonths", before: 5.4, possibleAfter: 5.4, direction: "flat", provenance: "bank_confirmed" },
    ],
    allocationRequired: true,
    assumptions: ["Singapore reference-rate estimate, as of 2026-06"],
  });
  assert.equal(is.resourceDelta.freedMonthly, 221);
  assert.equal(is.resourceDelta.addedPressureMonthly, 0);
  assert.equal(is.affectedGoals[0].confirmedAfter, null, "possible impact is a ghost until allocated");
  assert.equal(is.allocationRequired, true);
  assert.deepEqual(is.assumptions[0], { text: "Singapore reference-rate estimate, as of 2026-06" });
  assert.equal(validateImpactSet(is).ok, true);
});

test("validateImpactSet rejects a bad direction, a bad provenance, and a confirmedAfter with no before", () => {
  const bad = {
    affectedGoals: [
      { goalId: "home", direction: "sideways", provenance: "system_estimate" },
      { goalId: "x", direction: "up", provenance: "demo" },
      { goalId: "y", direction: "up", provenance: "bank_confirmed", confirmedAfter: 10, before: null },
    ],
    allocationRequired: "yes",
  };
  const r = validateImpactSet(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /direction/.test(e)));
  assert.ok(r.errors.some((e) => /provenance/.test(e)));
  assert.ok(r.errors.some((e) => /before/.test(e)));
  assert.ok(r.errors.some((e) => /allocationRequired/.test(e)));
});

test("the unified domain response shape has 15 required keys and an explicit sealable boolean", () => {
  assert.equal(STUDIO_RESPONSE_KEYS.length, 15);
  const ok = Object.fromEntries(STUDIO_RESPONSE_KEYS.map((k) => [k, null]));
  ok.sealableVerdict = { sealable: false, reason: "x" };
  ok.impactSet = buildImpactSet({ cause: "c" });
  assert.equal(validateStudioResponse(ok).ok, true);
  const missing = { ...ok };
  delete missing.impactSet;
  assert.equal(validateStudioResponse(missing).ok, false);
  const softSeal = { ...ok, sealableVerdict: { reason: "x" } };
  assert.ok(validateStudioResponse(softSeal).errors.some((e) => /explicit boolean/.test(e)));
});

test("assessStudio: no criteria met -> 'not done'; all met -> 'complete'; nothing in between lies", () => {
  const none = assessStudio({ domain: "loan" }, { domain: "loan" });
  assert.equal(none.status, "not done");
  assert.equal(none.metCount, 0);
  const all = assessStudio({ domain: "loan" }, Object.fromEntries(FLAGSHIP_CRITERIA.map((c) => [c.id, true])));
  assert.equal(all.status, "complete");
  assert.equal(all.metCount, FLAGSHIP_CRITERIA.length);
  const some = assessStudio({ domain: "loan" }, { native_scene: true, real_finance_recalc: true });
  assert.equal(some.status, "partial");
});

test("there are exactly 20 flagship completion criteria (Part A)", () => {
  assert.equal(FLAGSHIP_CRITERIA.length, 20);
});

// ---- registry contract wiring -------------------------------------
test("every registered Studio declares all eleven contract slots (null allowed, missing not)", () => {
  for (const d of livingPlanDomains()) {
    const c = getStudioContract(d);
    assert.ok(c, `${d} has a contract block`);
    for (const k of STUDIO_CONTRACT_KEYS) {
      assert.ok(k in c, `${d}.${k} is declared`);
    }
  }
});

test("Emergency still declares no native scene (Runway not built); Home now has Home Horizon", () => {
  assert.equal(getStudioContract("emergency").nativeScene, null);
  // Home Horizon landed in Living Thread commit 2
  assert.equal(getStudioContract("home").nativeScene, "features/home/HomeHorizon");
  assert.ok(getStudioContract("home").crossGoalProjector);
  for (const d of ["loan", "retirement", "travel", "investment", "insurance", "family", "wedding", "home"]) {
    assert.ok(getStudioContract(d).nativeScene, `${d} has a native scene wired`);
  }
});

test("wiredContractSlots reports only the non-null slots", () => {
  const loan = wiredContractSlots("loan");
  assert.ok(loan.includes("financeProjector") && loan.includes("crossGoalProjector") && loan.includes("turningPointRules"));
  assert.ok(!loan.includes("replayMapper"), "loan replayMapper is not built yet");
  const home = wiredContractSlots("home");
  assert.ok(home.includes("nativeScene") && home.includes("crossGoalProjector") && home.includes("turningPointRules") && home.includes("provenanceRules"));
  assert.ok(!home.includes("replayMapper"), "home ThreadMemoryScrubber mapping is commit 12");
  const emergency = wiredContractSlots("emergency");
  assert.ok(!emergency.includes("nativeScene"));
});
