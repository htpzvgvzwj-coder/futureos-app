// Guardian Contract — the fixed "never act" set and the plain-language
// summary. (setContract / getContracts hit the DB — see the integration
// test.)

import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES, CONTRACT_LEVELS, NEVER_ACT, contractSummary } from "../lib/guardian/contract.js";

test("emergency funds and the Wedding / Home plans can never reach 'act'", () => {
  for (const cap of ["move_emergency_funds", "change_wedding_plan", "change_home_plan", "make_external_payment"]) {
    assert.equal(CAPABILITIES[cap].maxLevel !== "act", true, cap);
    assert.ok(NEVER_ACT.includes(cap), cap);
  }
});

test("notify / flag default to 'watch'; money actions default to 'ask'", () => {
  assert.equal(CAPABILITIES.notify_a_guardian.defaultLevel, "watch");
  assert.equal(CAPABILITIES.flag_unusual_transaction.defaultLevel, "watch");
  assert.equal(CAPABILITIES.pause_plan_contribution.defaultLevel, "ask");
  assert.deepEqual(CONTRACT_LEVELS, ["watch", "ask", "act"]);
});

test("contractSummary splits into may / asks / never", () => {
  const contracts = [
    { capability: "pause_plan_contribution", label: "Pause a plan", level: "act", canAct: true },
    { capability: "move_between_own_accounts", label: "Move between accounts", level: "ask", canAct: false },
    { capability: "move_emergency_funds", label: "Move emergency money", level: "ask", canAct: false },
  ];
  const s = contractSummary(contracts);
  assert.deepEqual(s.may, ["Pause a plan"]);
  assert.ok(s.asks.includes("Move between accounts"));
  assert.ok(s.never.includes("Move emergency money"));
});
