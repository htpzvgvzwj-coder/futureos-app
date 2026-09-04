import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFutureFragments } from "../lib/life/fragments.js";

const baseLt = {
  availableMonthlyCashflow: 1400,
  monthlyExpenses: 3600,
  monthlyCommittedTotal: 2500,
  bankNow: { oneThingThisWeek: { kind: "card_payment", amount: 2400 } },
  commitments: [
    { id: "c1", domain: "home", monthlyContribution: 1500 },
    { id: "c2", domain: "wedding", monthlyContribution: 1000 },
  ],
  lifeNodes: [
    { id: "safety", value: 23.6 },
    { id: "home", horizon: "2031" },
    { id: "relationships", horizon: "2028" },
  ],
};

test("the funded profile yields one of each kind: protect, build, accelerate", () => {
  const frags = buildFutureFragments({ lt: baseLt, twin: { holdings: { incomeStreams: [{}] } } });
  assert.equal(frags.length, 3);
  assert.deepEqual(new Set(frags.map((f) => f.kind)), new Set(["protect", "build", "accelerate"]));
});

test("protect fragment is the flagged card bill, paid from flexible, buffer untouched", () => {
  const f = buildFutureFragments({ lt: baseLt }).find((x) => x.kind === "protect");
  assert.equal(f.needsOneOff, 2400);
  assert.equal(f.needsMonthly, 0);
  assert.equal(f.projected.bufferMonthsAfter, 23.6);
  assert.equal(f.projected.flexibleAfterOneOff, 1400 - 2400 < 0 ? 0 : 1400 - 2400);
});

test("build fragment never asks for more than the flexible money available", () => {
  const f = buildFutureFragments({ lt: baseLt }).find((x) => x.kind === "build");
  assert.ok(f.needsMonthly > 0 && f.needsMonthly <= 1400);
  assert.ok(f.projected.targetAmount === 3600 * 12);
  assert.ok(f.projected.readyYear >= new Date().getFullYear());
});

test("accelerate targets the biggest commitment and shifts it by a whole number of months", () => {
  const f = buildFutureFragments({ lt: baseLt }).find((x) => x.kind === "accelerate");
  assert.equal(f.projected.planShift.domain, "home");
  assert.ok(Number.isInteger(f.projected.planShift.monthsEarlier));
  assert.ok(f.projected.planShift.monthsEarlier >= 1);
  assert.ok(f.needsMonthly > 0 && f.needsMonthly <= 1400);
});

test("every fragment carries a non-empty 'why this appeared' and an estimate caveat", () => {
  for (const f of buildFutureFragments({ lt: baseLt })) {
    assert.ok(Array.isArray(f.whyItAppeared) && f.whyItAppeared.length > 0);
    assert.ok(f.whyItAppeared.some((l) => /estimate, not a confirmed result/i.test(l)));
  }
});

test("no flexible money -> no build or accelerate fragment (never invents room)", () => {
  const tight = { ...baseLt, availableMonthlyCashflow: 0, bankNow: {} };
  const frags = buildFutureFragments({ lt: tight });
  assert.equal(frags.filter((f) => f.kind === "build" || f.kind === "accelerate").length, 0);
});

test("empty input yields no fragments rather than throwing", () => {
  assert.deepEqual(buildFutureFragments({}), []);
  assert.deepEqual(buildFutureFragments({ lt: {} }), []);
});
