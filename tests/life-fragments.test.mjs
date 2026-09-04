import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFutureFragments, simulateFragment, describeFuture, FRAGMENT_SAFETY_FLOOR_MONTHS } from "../lib/life/fragments.js";

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

test("protect fragment spreads a bill bigger than one month's flexible money, never 'leaves SGD 0'", () => {
  const f = buildFutureFragments({ lt: baseLt }).find((x) => x.kind === "protect");
  // 2400 bill vs 1400/mo flexible -> 2 months at 1200/mo
  assert.equal(f.needsOneOff, 0);
  assert.equal(f.needsMonthly, 1200);
  assert.equal(f.projected.monthsToClear, 2);
  assert.equal(f.projected.bufferMonthsAfter, 23.6);
  assert.doesNotMatch(f.detail, /leaves SGD 0/);
});

test("protect fragment pays a small bill as a one-off when it fits in one month", () => {
  const lt = { ...baseLt, availableMonthlyCashflow: 3000, bankNow: { oneThingThisWeek: { kind: "card_payment", amount: 900 } } };
  const f = buildFutureFragments({ lt }).find((x) => x.kind === "protect");
  assert.equal(f.needsOneOff, 900);
  assert.equal(f.needsMonthly, 0);
  assert.equal(f.projected.flexibleAfterOneOff, 2100);
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

// ---- simulateFragment (the impact receipt) --------------------------

test("simulateFragment reports what's left flexible and passes the Guardian safety check", () => {
  const f = buildFutureFragments({ lt: baseLt }).find((x) => x.kind === "build");
  const r = simulateFragment(f, baseLt);
  assert.equal(r.needMonthly, f.needsMonthly);
  assert.equal(r.flexibleAfter, 1400 - f.needsMonthly);
  assert.equal(r.affordable, true);
  assert.equal(r.safetyOk, true); // buffer 23.6 >= floor
  assert.ok(r.guardian.ok);
  assert.ok(r.lines.length > 0);
});

test("simulateFragment with an override that exceeds flexible money is not affordable", () => {
  const f = buildFutureFragments({ lt: baseLt }).find((x) => x.kind === "accelerate");
  const r = simulateFragment(f, baseLt, { overrideMonthly: 5000 });
  assert.equal(r.affordable, false);
  assert.ok(r.flexibleAfter < 0);
});

test("simulateFragment flags the Guardian check when a fragment would dip the buffer below the floor", () => {
  const f = {
    id: "x", kind: "build", needsMonthly: 100, needsOneOff: 0,
    projected: { bufferMonthsAfter: FRAGMENT_SAFETY_FLOOR_MONTHS - 1, planShift: null },
  };
  const r = simulateFragment(f, baseLt);
  assert.equal(r.safetyOk, false);
  assert.equal(r.guardian.ok, false);
});

// ---- describeFuture (free-text -> ghost fragment) -------------------

test("describeFuture classifies an education goal and points at a Studio", () => {
  const d = describeFuture("I may study overseas in three years", baseLt);
  assert.equal(d.goalType, "education");
  assert.equal(d.described, true);
  assert.equal(d.horizonYear, new Date().getFullYear() + 3);
  assert.ok(d.needsMonthly > 0 && d.needsMonthly <= 1400);
  assert.equal(d.questions.length, 2);
});

test("describeFuture returns null for empty / too-short input", () => {
  assert.equal(describeFuture("", baseLt), null);
  assert.equal(describeFuture("hi", baseLt), null);
});

test("describeFuture still classifies when there is no flexible money, but sizes nothing", () => {
  const d = describeFuture("thinking about buying a car", { ...baseLt, availableMonthlyCashflow: 0 });
  assert.equal(d.goalType, "vehicle");
  assert.equal(d.needsMonthly, 0);
});
