// Guardian Phase 3 — Promise Shield, Collision Radar, Recovery Mode. Pure.

import test from "node:test";
import assert from "node:assert/strict";
import { buildPromiseShield, whichPromise } from "../lib/guardian/promise-shield.js";
import { detectCollision } from "../lib/guardian/collision.js";
import { buildRecoveryPlan } from "../lib/guardian/recovery.js";

// ---- Promise Shield ----
test("Promise Shield splits money into the four buckets from the real twin", () => {
  const s = buildPromiseShield({
    twin: { balanceBreakdown: { availableNow: 1200, spokenFor: 1700, protectedFor: 6000 } },
    safeToSpend: { currency: "SGD", breakdown: { nearTermObligations: 800, protectedReserve: 6000 } },
  });
  assert.deepEqual(s.buckets.map((b) => [b.id, b.amount]), [
    ["free", 1200],
    ["bills", 800],
    ["safety", 6000],
    ["goals", 1700],
  ]);
  assert.equal(s.total, 9700);
});

test("whichPromise: a spend inside free money breaks nothing; beyond it names the promise", () => {
  const s = buildPromiseShield({ twin: {}, safeToSpend: { currency: "SGD", safeToSpend: 500, breakdown: { nearTermObligations: 300, protectedReserve: 4000 } } });
  assert.equal(whichPromise(400, s).breaks, null);
  const b = whichPromise(650, s);
  assert.equal(b.breaks, "bills");
  assert.equal(b.overBy, 150);
  assert.equal(whichPromise(1000, s).breaks, "safety");
});

// ---- Collision Radar ----
const commitments = [
  { domain: "wedding", monthlyContribution: 1500 },
  { domain: "home", monthlyContribution: 1200 },
];

test("no collision when commitments fit the available cashflow", () => {
  const c = detectCollision({ commitments, availableMonthly: 3000 });
  assert.equal(c.collision, false);
  assert.equal(c.headroom, 300);
});

test("a collision names the plans, the shortfall, and three different paths", () => {
  const c = detectCollision({ commitments, availableMonthly: 2100 });
  assert.equal(c.collision, true);
  assert.equal(c.shortfallMonthly, 600);
  assert.deepEqual(c.competing, ["wedding", "home"]);
  assert.deepEqual(c.paths.map((p) => p.id), ["pause_smaller", "shrink_larger", "ease_both"]);
  assert.equal(c.paths.find((p) => p.id === "pause_smaller").target.domain, "home");
  assert.equal(c.paths.find((p) => p.id === "shrink_larger").target.to, 900); // 1500 - 600
  assert.equal(c.paths.find((p) => p.id === "ease_both").target.each, 300);
});

test("unknown cashflow -> no collision, flagged as unknown, never invented", () => {
  assert.equal(detectCollision({ commitments, availableMonthly: null }).reason, "unknown_cashflow");
});

// ---- Recovery Mode ----
test("not in trouble -> no recovery plan", () => {
  const r = buildRecoveryPlan({ safeToSpend: { belowProtectedFloor: false, projectedLowBalanceBeforeIncome: 400 }, rescueCases: [], commitments });
  assert.equal(r.inTrouble, false);
  assert.deepEqual(r.steps, []);
});

test("below the floor -> an ordered recovery sequence that leaves Home/Wedding and the buffer alone", () => {
  const r = buildRecoveryPlan({
    safeToSpend: { belowProtectedFloor: true, breakdown: { nearTermObligations: 900, protectedReserve: 5000 }, nextIncome: { expectedDate: "2026-09-28" } },
    rescueCases: [{ options: [{ id: "cancel_sub", label: "Cancel an unused subscription" }] }],
    commitments: [...commitments, { domain: "travel", monthlyContribution: 250 }],
  });
  assert.equal(r.inTrouble, true);
  assert.deepEqual(r.steps.map((s) => s.kind), ["guarantee_bills", "protect_floor", "pause_plans", "trim_spend", "recovery_date"]);
  const pause = r.steps.find((s) => s.kind === "pause_plans");
  assert.deepEqual(pause.targets, ["travel"]); // not home / wedding
  assert.equal(pause.frees, 250);
  assert.equal(r.recoveryDate, "2026-09-28");
});
