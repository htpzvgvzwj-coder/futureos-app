// Phase 6 Round 2 - the approval decision rule is pure and must be
// exhaustive: a supervised account, an amount rule, and the interaction.

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAuthorization, APPROVAL_KINDS } from "../lib/authorization/store.js";

const OFF = { restrictedNeedApproval: false, approvalOverAmount: null };
const RESTRICTED_ON = { restrictedNeedApproval: true, approvalOverAmount: null };

test("a supervised account with the rule on: every money move needs approval", () => {
  for (const kind of APPROVAL_KINDS) {
    for (const accountType of ["youth", "guardian_managed_child"]) {
      const v = evaluateAuthorization({ accountType, policy: RESTRICTED_ON, kind, amount: 1 });
      assert.equal(v.required, true, `${accountType}/${kind}`);
      assert.match(v.reason, /supervised/i);
    }
  }
});

test("a supervised account with the rule OFF: no approval from the supervised rule", () => {
  const v = evaluateAuthorization({ accountType: "youth", policy: OFF, kind: "internal_transfer", amount: 999999 });
  assert.equal(v.required, false);
});

test("an individual account: only the amount rule can require approval, and only strictly above it", () => {
  const policy = { restrictedNeedApproval: true, approvalOverAmount: 2000 };
  assert.equal(evaluateAuthorization({ accountType: "individual", policy, kind: "internal_transfer", amount: 1999 }).required, false);
  assert.equal(evaluateAuthorization({ accountType: "individual", policy, kind: "internal_transfer", amount: 2000 }).required, false, "equal is not above");
  const over = evaluateAuthorization({ accountType: "individual", policy, kind: "internal_transfer", amount: 2001 });
  assert.equal(over.required, true);
  assert.match(over.reason, /over/i);
});

test("the amount rule also protects a household / individual regardless of supervised flag", () => {
  const policy = { restrictedNeedApproval: false, approvalOverAmount: 500 };
  assert.equal(evaluateAuthorization({ accountType: "household", policy, kind: "card_repayment", amount: 600 }).required, true);
});

test("kinds that are not money moves are never gated", () => {
  const v = evaluateAuthorization({ accountType: "youth", policy: RESTRICTED_ON, kind: "capability:investment", amount: 10 });
  assert.equal(v.required, false);
  assert.equal(v.reason, null);
});

test("missing / zero amount is treated as 0 - below any positive amount rule", () => {
  const policy = { restrictedNeedApproval: false, approvalOverAmount: 100 };
  assert.equal(evaluateAuthorization({ accountType: "individual", policy, kind: "internal_transfer" }).required, false);
});
