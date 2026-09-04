// Pull the Future — the node→override mapping. Pure.

import test from "node:test";
import assert from "node:assert/strict";
import { PULLABLE, isPullable, buildPullSpec, overrideFor, captionFor } from "../lib/life/pull.js";

test("only the five planned nodes are pullable", () => {
  assert.deepEqual(Object.keys(PULLABLE).sort(), ["freedom", "future", "home", "relationships", "safety"]);
  assert.ok(isPullable("home"));
  assert.ok(!isPullable("income"));
  assert.equal(buildPullSpec("income", {}), null);
});

test("safety: slider is months of cushion, clamped, seeded from the plan", () => {
  const spec = buildPullSpec("safety", { target_months: 8 });
  assert.equal(spec.domain, "emergency");
  assert.equal(spec.key, "target_months");
  assert.equal(spec.value, 8);
  assert.deepEqual(overrideFor(spec, 4), { target_months: 4 });
  assert.deepEqual(overrideFor(spec, 99), { target_months: 12 }); // clamped to max
  assert.match(captionFor(spec, 3), /3 months of cushion/);
});

test("home: slider is a month offset around today's target", () => {
  const spec = buildPullSpec("home", { target_complete_month: "2030-01" });
  assert.equal(spec.value, 0); // starts at today's plan
  assert.equal(spec.anchor, "2030-01");
  assert.deepEqual(overrideFor(spec, -6), { target_complete_month: "2029-07" });
  assert.deepEqual(overrideFor(spec, 12), { target_complete_month: "2031-01" });
  assert.match(captionFor(spec, -6), /6 months sooner/);
  assert.match(captionFor(spec, 3), /3 months later/);
  assert.match(captionFor(spec, 0), /today's plan/i);
});

test("freedom: monthly dollars, clamped to the range", () => {
  const spec = buildPullSpec("freedom", { monthly_commitment: 500 });
  assert.equal(spec.value, 500);
  assert.deepEqual(overrideFor(spec, 1200), { monthly_commitment: 1200 });
  assert.deepEqual(overrideFor(spec, 9999), { monthly_commitment: 3000 });
  assert.match(captionFor(spec, 800), /SGD 800\/month/);
});

test("future: retirement age", () => {
  const spec = buildPullSpec("future", { future_age: 62 });
  assert.equal(spec.value, 62);
  assert.deepEqual(overrideFor(spec, 58), { future_age: 58 });
  assert.deepEqual(overrideFor(spec, 40), { future_age: 55 });
  assert.match(captionFor(spec, 67), /Retire at 67/);
});

test("a missing anchor still yields a valid YYYY-MM override", () => {
  const spec = buildPullSpec("relationships", {});
  const ov = overrideFor(spec, 6);
  assert.match(ov.wedding_date, /^\d{4}-\d{2}$/);
});
