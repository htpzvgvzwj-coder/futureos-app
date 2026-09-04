// Life Memory — the direction-changing filter, the 5-part record shape,
// the always-present starting point, the time buckets. Pure.

import test from "node:test";
import assert from "node:assert/strict";
import { buildLifeMemory, latestMovementLine } from "../lib/life/memory.js";

const ev = (over) => ({
  id: `e${Math.random().toString(36).slice(2, 6)}`,
  actor: "user",
  source_feature: "home",
  action_type: "plan_updated",
  status: "scheduled",
  related_goal_ids: ["home"],
  cause: { trigger: "future_field_seal" },
  impact_set: [],
  occurred_at: new Date().toISOString(),
  ...over,
});

const twin = { holdings: { cashAccounts: [{}, {}], incomeStreams: [{}] } };
const lifeThread = { commitments: [{ domain: "home" }, { domain: "emergency" }] };

test("routine transactions are dropped; direction-changing events are kept", () => {
  const events = [
    ev({ action_type: "payment_made", impact_set: [{ goalId: "spendable", metric: "x", before: 100, after: 88 }] }), // tiny -> dropped
    ev({ action_type: "plan_updated" }),
    ev({ action_type: "commitment_paused", source_feature: "wedding", related_goal_ids: ["wedding"] }),
    ev({ action_type: "some_random_thing" }), // unknown -> dropped
  ];
  const m = buildLifeMemory({ events, twin, lifeThread });
  assert.equal(m.count, 2, "only the plan_updated + commitment_paused kept");
  assert.ok(m.records.some((r) => /Home plan changed/.test(r.what)));
  assert.ok(m.records.some((r) => /Wedding plan paused/.test(r.what)));
});

test("a large payment IS kept", () => {
  const m = buildLifeMemory({
    events: [ev({ action_type: "payment_made", impact_set: [{ goalId: "spendable", metric: "x", before: 5000, after: 3500 }] })],
    twin,
    lifeThread,
  });
  assert.equal(m.count, 1);
  assert.match(m.records[0].what, /large payment/i);
});

test("each record answers the five things", () => {
  const m = buildLifeMemory({
    events: [
      ev({
        action_type: "plan_updated",
        impact_set: [
          { goalId: "cashflow", metric: "freeMonthlyCashflow", before: 3900, after: 3600, unit: "sgd" },
          { goalId: "wedding", metric: "readyMonthShift", unit: "date_shift_months", before: 0, after: -2 },
          { goalId: "home", metric: "readyMonthShift", unit: "date_shift_months", before: 0, after: 1 },
        ],
      }),
    ],
    twin,
    lifeThread,
  });
  const r = m.records[0];
  assert.ok(r.what, "what happened");
  assert.ok(r.why, "why it matters");
  assert.deepEqual(r.money, { label: "Free each month", before: 3900, after: 3600, unit: "sgd" }, "how much money changed");
  assert.ok(r.plansMoved.some((p) => /Wedding: 2 months sooner/.test(p.text)), "which plans moved");
  assert.ok(r.plansMoved.some((p) => /Home: 1 months later/.test(p.text)));
  assert.ok(r.guardian, "what Guardian did");
  assert.ok(r.source, "source");
  assert.ok(r.evidence.impactSet.length === 3, "raw evidence carried");
});

test("the starting point always exists, even with no events", () => {
  const m = buildLifeMemory({ events: [], twin, lifeThread });
  assert.equal(m.latest, null, "no latest movement");
  assert.equal(m.startingPoint.what, "Your starting point");
  assert.match(m.startingPoint.detail, /2 accounts, 1 income source, 2 plans/);
  // it shows up as its own bucket
  assert.ok(m.buckets.some((b) => b.id === "startingPoint" && b.records.length === 1));
});

test("time buckets: today / this month / earlier / starting point", () => {
  const now = new Date();
  const thisMonthOld = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 5)).toISOString();
  const lastYear = new Date(now.getFullYear() - 1, 1, 1).toISOString();
  const m = buildLifeMemory({
    events: [ev({}), ev({ occurred_at: thisMonthOld }), ev({ occurred_at: lastYear })],
    twin,
    lifeThread,
  });
  const ids = m.buckets.map((b) => b.id);
  assert.deepEqual(ids, ["today", "thisMonth", "earlier", "startingPoint"]);
});

test("latestMovementLine summarises the most recent record", () => {
  const m = buildLifeMemory({
    events: [
      ev({
        action_type: "plan_updated",
        impact_set: [
          { goalId: "cashflow", metric: "freeMonthlyCashflow", before: 3480, after: 3900, unit: "sgd" },
          { goalId: "home", metric: "readyMonthShift", unit: "date_shift_months", before: 0, after: -2 },
        ],
      }),
    ],
    twin,
    lifeThread,
  });
  const line = latestMovementLine(m);
  // line 0 is { key, params }, line 1 is { text }
  assert.match(line.lines[0].key, /increased by \{amt\}/);
  assert.equal(line.lines[0].params.amt, "SGD 420");
  assert.match(line.lines[1].text, /Home: 2 months sooner/);
});
