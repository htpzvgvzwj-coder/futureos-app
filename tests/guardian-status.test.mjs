// Guardian Now — the reducer must return exactly one state, one cause, one
// action, picked by priority. No "five warning cards".

import test from "node:test";
import assert from "node:assert/strict";
import { reduceGuardianStatus, GUARDIAN_LEVELS } from "../lib/guardian/status.js";

const moment = (over) => ({ state: "new", severity: "watch", sourceType: "detected_problem", id: "m1", title: "t", summary: "s", nextActions: [], ...over });

test("empty account -> calm with a setup action", () => {
  const s = reduceGuardianStatus({ isEmpty: true });
  assert.equal(s.level, "calm");
  assert.equal(s.needsSetup, true);
  assert.equal(s.primaryAction.route, "reality");
});

test("nothing wrong -> calm, no action", () => {
  const s = reduceGuardianStatus({ moments: [], bankNow: { belowProtectedFloor: false } });
  assert.equal(s.level, "calm");
  assert.equal(s.primaryAction, null);
  assert.match(s.headline, /keeping its promises/i);
});

test("below the safety floor -> urgent, and it wins over a watch", () => {
  const s = reduceGuardianStatus({
    moments: [moment({ severity: "watch", summary: "spending up" })],
    bankNow: { belowProtectedFloor: true },
  });
  assert.equal(s.level, "urgent");
});

test("an action_required money problem -> urgent with that moment's action", () => {
  const s = reduceGuardianStatus({
    moments: [moment({ severity: "action_required", summary: "payment failed", nextActions: [{ label: "Fix it", route: "rescue" }] })],
    bankNow: { belowProtectedFloor: false },
  });
  assert.equal(s.level, "urgent");
  assert.equal(s.primaryAction.route, "rescue");
  assert.equal(s.cause, "payment failed");
});

test("a plan collision reads as a decision, not urgent", () => {
  const s = reduceGuardianStatus({
    moments: [moment({ severity: "action_required", title: "Home and Wedding now compete for SGD 800/month", summary: "two plans, one cashflow" })],
    bankNow: { belowProtectedFloor: false },
  });
  assert.equal(s.level, "decision");
});

test("only a watch -> watching, carries that moment's cause", () => {
  const s = reduceGuardianStatus({
    moments: [moment({ severity: "watch", summary: "next month may be tight" })],
    bankNow: { belowProtectedFloor: false },
  });
  assert.equal(s.level, "watching");
  assert.equal(s.cause, "next month may be tight");
});

test("the result is always a single well-formed status", () => {
  for (const mm of [{}, { isEmpty: true }, { moments: [moment(), moment({ severity: "action_required" })], bankNow: {} }]) {
    const s = reduceGuardianStatus(mm);
    assert.ok(GUARDIAN_LEVELS.includes(s.level));
    assert.equal(typeof s.headline, "string");
    assert.ok("cause" in s && "primaryAction" in s && "momentKey" in s);
  }
});
