import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveStage, stageCapabilities, describeStage, ageFromBirthYear } from "../lib/family-relay/stages.js";
import { evaluateAskToPay } from "../lib/family-relay/ask-to-pay.js";
import { evaluatePaymentPause } from "../lib/family-relay/payment-pause.js";

// ---- stages ----

test("resolveStage maps account type + roles to a life stage", () => {
  assert.equal(resolveStage({ accountType: "guardian_managed_child" }), "child");
  assert.equal(resolveStage({ accountType: "youth", birthYear: new Date().getFullYear() - 15 }), "youth");
  assert.equal(resolveStage({ accountType: "youth", birthYear: new Date().getFullYear() - 10 }), "child");
  assert.equal(resolveStage({ accountType: "individual" }), "independent");
  assert.equal(resolveStage({ accountType: "individual", roles: [{ role: "dependent", scope: "manage", status: "active" }] }), "family_guardian");
  assert.equal(resolveStage({ accountType: "individual", roles: [{ role: "trusted_contact", scope: "suggest", status: "active" }] }), "later_life");
});

test("ageFromBirthYear rejects nonsense", () => {
  assert.equal(ageFromBirthYear(2010, new Date("2026-06-01")), 16);
  assert.equal(ageFromBirthYear(1700), null);
  assert.equal(ageFromBirthYear("abc"), null);
});

test("a child's 'ask' capabilities hold as 'no' until a guardian is actually linked", () => {
  const unlinked = stageCapabilities("child", { guardianLinked: false });
  assert.equal(unlinked.spend_small, "no");
  const linked = stageCapabilities("child", { guardianLinked: true });
  assert.equal(linked.spend_small, "ask");
  assert.equal(linked.pay_out, "no"); // still a flat no for a child
});

test("describeStage splits capabilities into can / needsApproval / cannot", () => {
  const d = describeStage("youth", { guardianLinked: true });
  assert.ok(d.can.includes("Small everyday spending"));
  assert.ok(d.needsApproval.includes("Pay somewhere new"));
  assert.ok(d.cannot.includes("Borrow"));
  assert.equal(d.surface, "growing_account");
});

// ---- Ask to Pay ----

const goals = [{ label: "New bike", monthlyContribution: 60 }];

test("a small, familiar, within-week payment is auto-OK with visible reasons", () => {
  const r = evaluateAskToPay({
    amount: 12, merchant: "Popular Bookstore",
    weeklyAllowance: 30, spentThisWeek: 5,
    knownMerchants: ["Popular Bookstore"], savingsGoals: goals,
    policy: { autoApproveUnder: 20, alwaysApproveOver: 50, newMerchantNeedsApproval: true },
  });
  assert.equal(r.outcome, "auto_ok");
  assert.equal(r.remainingAfter, 13);
  assert.ok(r.reasons.some((x) => x.code === "known_merchant" && x.tone === "ok"));
});

test("a new merchant pushes an otherwise-fine payment to needs_approval", () => {
  const r = evaluateAskToPay({
    amount: 15, merchant: "Some Game Shop",
    weeklyAllowance: 40, spentThisWeek: 0,
    knownMerchants: ["Popular Bookstore"],
    policy: { autoApproveUnder: 20, newMerchantNeedsApproval: true },
  });
  assert.equal(r.outcome, "needs_approval");
  assert.ok(r.reasons.some((x) => x.code === "new_merchant"));
});

test("over the week's allowance is blocked and says by how much", () => {
  const r = evaluateAskToPay({ amount: 50, merchant: "Popular Bookstore", weeklyAllowance: 30, spentThisWeek: 10, knownMerchants: ["Popular Bookstore"] });
  assert.equal(r.outcome, "blocked");
  const over = r.reasons.find((x) => x.code === "over_week");
  assert.match(over.text, /30/); // 50 - (30 - 10) = 30 more than what's left
});

test("Ask to Pay surfaces the savings-goal impact without blocking", () => {
  const r = evaluateAskToPay({
    amount: 30, merchant: "Popular Bookstore",
    weeklyAllowance: 100, spentThisWeek: 0,
    knownMerchants: ["Popular Bookstore"], savingsGoals: goals,
    policy: { autoApproveUnder: 40 },
  });
  assert.ok(r.goalImpact && r.goalImpact.daysLater >= 1);
  assert.notEqual(r.outcome, "blocked");
});

// ---- Payment Pause ----

const recent = [
  { payee: "SP Group", amount: 140, at: Date.now() - 5 * 86_400_000 },
  { payee: "Singtel", amount: 42, at: Date.now() - 6 * 86_400_000 },
];

test("a normal payment to a known payee is not paused", () => {
  const r = evaluatePaymentPause({ amount: 140, payee: "SP Group", knownPayees: ["SP Group", "Singtel"], recentPayments: recent, typicalMax: 300 });
  assert.equal(r.paused, false);
  assert.deepEqual(r.options, ["continue"]);
});

test("a new payee pauses with an explanation and always offers continue", () => {
  const r = evaluatePaymentPause({ amount: 200, payee: "J. Tan", knownPayees: ["SP Group"], recentPayments: recent, typicalMax: 300 });
  assert.equal(r.paused, true);
  assert.ok(r.triggers.some((t) => t.code === "new_payee"));
  assert.ok(r.options.includes("continue") && r.options.includes("call_trusted"));
});

test("an amount well above the account's pattern pauses", () => {
  const r = evaluatePaymentPause({ amount: 3000, payee: "SP Group", knownPayees: ["SP Group"], recentPayments: recent, typicalMax: 300 });
  assert.equal(r.paused, true);
  assert.ok(r.triggers.some((t) => t.code === "unusual_amount"));
});

test("a near-duplicate of a payment in the last few days pauses", () => {
  const dupRecent = [{ payee: "J. Tan", amount: 500, at: Date.now() - 1 * 86_400_000 }];
  const r = evaluatePaymentPause({ amount: 500, payee: "J. Tan", knownPayees: ["J. Tan"], recentPayments: dupRecent, typicalMax: 1000 });
  assert.equal(r.paused, true);
  assert.ok(r.triggers.some((t) => t.code === "possible_duplicate"));
});

test("age alone never pauses a normal payment", () => {
  const r = evaluatePaymentPause({ amount: 80, payee: "NTUC FairPrice", knownPayees: ["NTUC FairPrice"], recentPayments: recent, typicalMax: 300 });
  assert.equal(r.paused, false);
});
