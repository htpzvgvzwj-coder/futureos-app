// The Living Thread builder — Life Direction, the three numbers, node
// visual state (solid/hollow/ghost/pulse), What Moved, weather. Pure.

import test from "node:test";
import assert from "node:assert/strict";
import { buildLivingThread } from "../lib/life/thread.js";

const node = (id, over) => ({ id, value: null, known: false, moving: false, waiting: false, state: "unknown", ...over });

test("a fresh account: hollow nodes, a 'start a plan' direction, calm weather", () => {
  const lt = {
    lifeNodes: [node("income"), node("safety"), node("home"), node("relationships"), node("freedom"), node("future")],
    commitments: [],
    availableMonthlyCashflow: null,
  };
  const t = buildLivingThread({ lt, moments: [] });
  assert.match(t.direction, /Start a plan/i);
  assert.equal(t.weather.id, "calm");
  assert.ok(t.nodes.every((n) => ["hollow", "solid"].includes(n.state)));
  assert.equal(t.numbers.find((n) => n.id === "flexible").value, null); // never invented
  assert.equal(t.numbers.find((n) => n.id === "afterLiving").value, null);
});

test("node forms: known+still = solid, moving draft = ghost, recent change = pulse", () => {
  const lt = {
    lifeNodes: [
      node("income", { known: true, value: 4000, state: "calm" }),
      node("safety", { known: true, value: 5.8, state: "calm" }),
      node("home", { known: true, moving: true, state: "moving" }),
    ],
    commitments: [{ domain: "home", monthlyContribution: 1200 }],
    availableMonthlyCashflow: 2100,
  };
  const planMovement = [{ domain: "safety", monthlyReleased: 200 }];
  const t = buildLivingThread({ lt, moments: [], planMovement });
  const by = Object.fromEntries(t.nodes.map((n) => [n.id, n.state]));
  assert.equal(by.income, "solid");
  assert.equal(by.home, "ghost");
  assert.equal(by.safety, "pulse"); // studioImpacts flagged it as recently changed
});

test("a collision drives the direction, marks the two nodes, and tightens the weather", () => {
  const lt = {
    lifeNodes: [node("relationships", { known: true, state: "calm" }), node("home", { known: true, state: "calm" }), node("safety", { known: true, value: 4, state: "calm" })],
    commitments: [
      { domain: "wedding", monthlyContribution: 1500 },
      { domain: "home", monthlyContribution: 1200 },
    ],
    availableMonthlyCashflow: 2100,
  };
  const collision = { collision: true, competing: ["wedding", "home"], summary: "…a SGD 600/month collision." };
  const t = buildLivingThread({ lt, moments: [], collision });
  assert.match(t.direction, /Wedding and Home are beginning to compete/i);
  assert.equal(t.weather.id, "tight");
  assert.equal(t.nodes.find((n) => n.id === "relationships").collision, true);
  assert.equal(t.nodes.find((n) => n.id === "home").collision, true);
});

test("What Moved surfaces the latest change and up to three knock-on effects", () => {
  const lt = {
    lifeNodes: [node("home", { known: true, state: "calm" })],
    commitments: [],
    availableMonthlyCashflow: 1000,
    latestChange: { headline: "You increased Wedding by SGD 300/month", occurredAt: new Date().toISOString(), status: "scheduled", actionType: "plan_updated" },
  };
  const planMovement = [
    { domain: "wedding", monthlyReleased: 0, affected: [{ domain: "wedding", monthsDelta: -2 }] },
    { domain: "home", monthlyReleased: 0, affected: [{ domain: "home", monthsDelta: 1 }] },
  ];
  const t = buildLivingThread({ lt, moments: [], planMovement });
  assert.equal(t.whatMoved.headline, "You increased Wedding by SGD 300/month");
  assert.ok(t.whatMoved.impacts.some((s) => /Wedding: 2 months sooner/.test(s)));
  assert.ok(t.whatMoved.impacts.some((s) => /Home: 1 months later/.test(s)));
  assert.ok(t.whatMoved.impacts.length <= 3);
});

test("below the safety floor -> Exposed weather + a rebuild direction", () => {
  const lt = {
    lifeNodes: [node("safety", { known: true, value: 1.2, waiting: true, state: "waiting_decision" })],
    commitments: [],
    availableMonthlyCashflow: 500,
  };
  const t = buildLivingThread({ lt, moments: [] });
  assert.equal(t.weather.id, "exposed");
  assert.match(t.direction, /safety buffer is below your floor/i);
});
