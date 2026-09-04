// Life Thread snapshot helpers — pure parts only (the DB parts are covered
// by the integration test).

import test from "node:test";
import assert from "node:assert/strict";
import { compactThread, movedBetween } from "../lib/life/snapshot-shape.js";

test("compactThread keeps only the renderable, storable shape", () => {
  const ct = compactThread({
    direction: "You're reshaping home — nothing is committed until you seal it.",
    directionKey: "You're reshaping {node} — nothing is committed until you seal it.",
    directionParams: { node: "home" },
    weather: { id: "tight", label: "Tight", note: "…", noteKey: "…", noteParams: {} },
    numbers: [
      { id: "free", label: "Free each month", value: "SGD 3,600", emptyHint: "x", source: "y" },
      { id: "safety", label: "Safety buffer", value: null },
    ],
    nodes: [
      { id: "home", label: "Home", state: "ghost", valueText: null, note: "Draft — not sealed", cta: "Open Home", ring: false, collision: false },
    ],
    whatMoved: { headline: "drop me" },
    futureSlot: { label: "drop me too" },
  });
  assert.deepEqual(Object.keys(ct).sort(), ["direction", "directionKey", "directionParams", "nodes", "numbers", "weather"]);
  assert.equal(ct.weather.note, undefined, "no note/noteKey stored");
  assert.equal(ct.numbers[0].emptyHint, undefined, "number stripped to id/label/value");
  assert.equal(ct.nodes[0].cta, undefined, "node stripped to id/label/state/valueText/note");
  assert.equal(ct.nodes[0].note, "Draft — not sealed");
  assert.deepEqual(ct.directionParams, { node: "home" });
});

test("compactThread tolerates a bare / empty thread", () => {
  assert.deepEqual(compactThread({}), { direction: null, directionKey: null, directionParams: null, weather: null, numbers: [], nodes: [] });
  assert.deepEqual(compactThread().nodes, []);
});

test("movedBetween compares stored figures then vs now", () => {
  const snap = { free_monthly: 3600, committed_monthly: 1900, safety_months: 4.9 };
  const moved = movedBetween(snap, { free_monthly: 3450, committed_monthly: 1900, safety_months: 4.6 });
  assert.equal(moved.length, 2, "only free + safety changed");
  assert.deepEqual(moved.find((m) => m.label === "Free each month"), { label: "Free each month", unit: "sgd", then: 3600, now: 3450 });
  assert.ok(moved.find((m) => m.label === "Safety buffer"));
});

test("movedBetween: null snapshot -> nothing", () => {
  assert.deepEqual(movedBetween(null, { free_monthly: 1 }), []);
});
