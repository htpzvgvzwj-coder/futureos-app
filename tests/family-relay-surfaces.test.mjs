import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrowingAccount, summariseMoneySeeds, learnMoment, growingPermissions,
  buildCalmToday, buildBillContinuity, buildHandoverChecklist,
} from "../lib/family-relay/surfaces.js";

test("Growing Account shows the week's remaining allowance and goal progress, no jargon", () => {
  const g = buildGrowingAccount({
    balance: 120, weeklyAllowance: 40, spentThisWeek: 25,
    goals: [{ label: "New bike", saved: 45, target: 180 }],
    recentSpending: [{ merchant: "Kopitiam", amount: 5 }],
    pendingRequests: [{ amount: 20, merchant: "Game Shop" }],
  });
  assert.equal(g.thisWeek.remaining, 15);
  assert.equal(g.savingFor[0].percent, 25);
  assert.equal(g.waitingForYes[0].amount, 20);
  assert.equal(g.haveText, "SGD 120");
});

test("Money Seeds total and each seed's route to a Life Thread node", () => {
  const s = summariseMoneySeeds(
    [{ kind: "education", balance: 8000, monthly: 100 }, { kind: "first_home", balance: 3000, monthly: 50 }],
    { childAge: 12, maturesAtAge: 18 },
  );
  assert.equal(s.total, 11000);
  assert.equal(s.seeds[0].becomesDomain, "retirement");
  assert.equal(s.seeds[1].becomesDomain, "home");
  assert.match(s.seeds[0].note, /6 years/);
});

test("learnMoment states a real trade-off and the balance after", () => {
  const m = learnMoment({ balance: 40, amount: 18, goal: { label: "bike", monthlyContribution: 90 } });
  assert.match(m.text, /You have SGD 40/);
  assert.match(m.text, /bike/);
  assert.equal(m.balanceAfter, 22);
  assert.equal(learnMoment({ balance: null, amount: 5 }), null);
});

test("growingPermissions marks age-reached rungs 'ready' and applied ones 'applied'", () => {
  const rungs = growingPermissions({ childAge: 16, appliedRungIds: ["view_save", "small_spend"] });
  assert.equal(rungs.find((r) => r.id === "view_save").state, "applied");
  assert.equal(rungs.find((r) => r.id === "small_autonomy").state, "ready"); // atAge 16
  assert.equal(rungs.find((r) => r.id === "cards_fx").state, "future"); // atAge 18
});

test("Calm Today keeps one balance, next income, next bill, one thing, a call list", () => {
  const c = buildCalmToday({
    balance: 5200,
    nextIncome: { label: "Pension", amount: 2100, when: "in 4 days" },
    nextBill: { label: "SP Group", amount: 140, when: "in 2 days" },
    oneThing: { text: "A payment to a new payee is waiting", kind: "pause" },
    trustedContacts: [{ relationLabel: "My daughter", role: "trusted_contact" }],
  });
  assert.equal(c.balanceText, "SGD 5,200");
  assert.equal(c.nextIncome.amount, 2100);
  assert.equal(c.callList[0].label, "My daughter");
});

test("Bill Continuity picks the critical bills and how long the balance covers them", () => {
  const b = buildBillContinuity({
    obligations: [
      { label: "Rent", category: "housing", monthlyAmount: 2000, nextDueDate: "2026-10-01" },
      { label: "SP Group", category: "utilities", monthlyAmount: 140 },
      { label: "Netflix", category: "entertainment", monthlyAmount: 20 },
    ],
    balance: 8600, monthlyIncome: 7500,
  });
  assert.equal(b.bills.length, 2); // rent + utilities, not Netflix
  assert.equal(b.monthsCovered, 4); // 8600 / 2140
  assert.ok(b.incomeKnown);
});

test("Handover checklist marks items done from what's already in the account", () => {
  const list = buildHandoverChecklist({
    accountsCount: 3, incomeCount: 1, obligationsCount: 6, rolesCount: 2,
    handoff: { successorLabel: "My sister", instructions: "Keep the bills paid" }, beneficiaryCount: 0,
  });
  assert.equal(list.find((i) => i.id === "accounts").done, true);
  assert.equal(list.find((i) => i.id === "successor").done, true);
  assert.equal(list.find((i) => i.id === "beneficiary").done, false);
});
