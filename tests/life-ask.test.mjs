// Future Echo + Ask the Line — both pure, both refuse to invent a number.

import test from "node:test";
import assert from "node:assert/strict";
import { buildFutureEcho, answerLineQuestion } from "../lib/life/ask.js";

const lt = {
  commitments: [
    { domain: "home", monthlyContribution: 700, status: "active" },
    { domain: "wedding", monthlyContribution: 500, status: "active" },
    { domain: "emergency", monthlyContribution: 250, status: "active" },
    { domain: "travel", monthlyContribution: 0, status: "active" },
    { domain: "old", monthlyContribution: 400, status: "revoked" },
  ],
  lifeNodes: [{ id: "safety", value: 4.2 }],
  availableMonthlyCashflow: 600,
  monthlyExpenses: 2800,
  monthlyCommittedTotal: 1450,
  activePlans: [],
};

test("Future Echo: contributions only, sorted, no zero rows, no revoked", () => {
  const e = buildFutureEcho({ lt });
  assert.deepEqual(e.plans.map((p) => p.domain), ["home", "wedding", "emergency"]);
  const home = e.plans[0];
  assert.equal(home.at.find((a) => a.years === 3).added, 700 * 12 * 3);
  assert.match(e.basis, /no assumed investment return/i);
});

test("Future Echo: safety projection only when buffer + free cashflow + expenses are known", () => {
  const e = buildFutureEcho({ lt });
  assert.ok(e.safety);
  assert.equal(e.safety.nowMonths, 4.2);
  assert.ok(e.safety.at.find((a) => a.years === 1).months > 4.2);

  const noExpense = buildFutureEcho({ lt: { ...lt, monthlyExpenses: null } });
  assert.equal(noExpense.safety, null);
});

test("Future Echo: nothing funded -> empty plans", () => {
  assert.deepEqual(buildFutureEcho({ lt: { commitments: [] } }).plans, []);
});

test("Ask the Line: safety question reads the real buffer", () => {
  const a = answerLineQuestion("how long would my safety buffer last", { lt });
  assert.equal(a.kind, "safety");
  assert.match(a.text, /4\.2 months/);
});

test("Ask the Line: pausing a real commitment reports the freed amount", () => {
  const a = answerLineQuestion("what if I pause the wedding", { lt });
  assert.equal(a.kind, "pause");
  assert.match(a.text, /SGD 500 a month/);
});

test("Ask the Line: pausing something you don't fund says so", () => {
  const a = answerLineQuestion("what if I stop retirement", { lt });
  assert.match(a.text, /don't have an active monthly commitment/i);
});

test("Ask the Line: free-cashflow question, and the unknown case is honest", () => {
  assert.match(answerLineQuestion("how much is free each month", { lt }).text, /SGD 600 a month/);
  const unknown = answerLineQuestion("how much is free each month", { lt: { availableMonthlyCashflow: null } });
  assert.match(unknown.text, /not worked out yet/i);
});

test("Ask the Line: collision question with and without a collision", () => {
  const withC = answerLineQuestion("are any plans competing for money", { lt, collision: { collision: true, summary: "Home and the wedding want SGD 300 more than you have." } });
  assert.match(withC.text, /Home and the wedding/);
  const noC = answerLineQuestion("are any plans competing for money", { lt, collision: { collision: false } });
  assert.match(noC.text, /None of your plans are competing/i);
});

test("Ask the Line: an unparseable question returns examples, never a guess", () => {
  const a = answerLineQuestion("what is the meaning of life", { lt });
  assert.equal(a.kind, "unknown");
  assert.equal(a.text, null);
  assert.ok(a.examples.length >= 3);
});

test("Ask the Line: empty input", () => {
  assert.equal(answerLineQuestion("   ", { lt }).kind, "empty");
});
