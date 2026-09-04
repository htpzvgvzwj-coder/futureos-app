// Future Echo from a Today payment + the Node Moment Sheet builder. Pure.

import test from "node:test";
import assert from "node:assert/strict";
import { echoPayment, ECHO_MIN } from "../lib/life/echo-payment.js";
import { buildNodeMoment } from "../lib/life/moment.js";

const lt = {
  lifeNodes: [
    { id: "safety", value: 4.6, known: true },
    { id: "income", value: 6000, known: true },
    { id: "freedom", value: 400, known: true },
    { id: "home", known: true },
  ],
  commitments: [
    { domain: "home", monthlyContribution: 700, status: "active" },
    { domain: "wedding", monthlyContribution: 500, status: "active" },
    { domain: "emergency", monthlyContribution: 250, status: "active" },
  ],
};

test("echoPayment: exact free-money hit, safety verdict, a plan day-shift", () => {
  const e = echoPayment({ amount: 1200, safeToSpend: 3000, protectedReserve: 21000, lifeThread: lt });
  assert.equal(e.amount, 1200);
  assert.match(e.lines[0].key, /Free money drops by/);
  assert.deepEqual(e.lines[0].params, { v: "SGD 1,200" });
  // 3000 - 1200 = 1800 < 21000 -> would dip
  assert.match(e.lines[1].key, /dip into your safety buffer/);
  // biggest plan = home @ 700; 1200/700*30 ≈ 51 days
  const plan = e.lines.find((l) => l.id === "plan");
  assert.match(plan.key, /may reach its date about/);
  assert.equal(plan.params.plan, "Home");
  assert.ok(plan.params.n >= 45 && plan.params.n <= 55);
});

test("echoPayment: a payment that leaves the buffer intact says so", () => {
  const e = echoPayment({ amount: 500, safeToSpend: 30000, protectedReserve: 21000, lifeThread: lt });
  assert.match(e.lines[1].key, /stays protected/);
});

test("echoPayment: tiny plan shift -> 'plans keep their dates'", () => {
  const e = echoPayment({ amount: 50, safeToSpend: 5000, protectedReserve: 1000, lifeThread: lt });
  assert.match(e.lines.find((l) => l.id === "plan").key, /keep their dates/);
});

test("ECHO_MIN is a sane threshold", () => {
  assert.ok(ECHO_MIN >= 100 && ECHO_MIN <= 1000);
});

test("buildNodeMoment: a funded node shows standing, monthly used, action", () => {
  const m = buildNodeMoment({
    nodeId: "home",
    lt,
    memory: { records: [{ domain: "home", what: "Home plan changed", when: new Date().toISOString(), plansMoved: ["Wedding: 1 months later"] }] },
    planMovement: [],
  });
  assert.equal(m.label, "Home");
  assert.equal(m.domain, "home");
  assert.equal(m.monthlyUsed, 700);
  assert.match(m.whyMoved.what, /Home plan changed/);
  assert.ok(m.affecting.includes("Wedding"));
  assert.match(m.action.key, /Open the {studio} Studio/);
  assert.equal(m.action.params.studio, "Home");
});

test("buildNodeMoment: safety node reads in months; income node routes to Today", () => {
  const s = buildNodeMoment({ nodeId: "safety", lt, memory: null, planMovement: [] });
  assert.match(s.standing.key, /Covers {n} months/);
  assert.equal(s.standing.params.n, "4.6");

  const t = buildNodeMoment({ nodeId: "income", lt, memory: null, planMovement: [] });
  assert.equal(t.domain, null);
  assert.equal(t.action.key, "Open Today");
});

test("buildNodeMoment: an unknown node says 'not set up yet'", () => {
  const m = buildNodeMoment({ nodeId: "future", lt: { lifeNodes: [{ id: "future", known: false }], commitments: [] }, memory: null, planMovement: [] });
  assert.match(m.standing.key, /Not set up yet/);
  assert.equal(m.monthlyUsed, null);
});
