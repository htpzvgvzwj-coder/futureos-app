// Guardian Phase 2 — the impact a money move has on the promises, computed
// from the real safe-to-spend view. Pure.

import test from "node:test";
import assert from "node:assert/strict";
import { buildMoveImpact } from "../lib/guardian/decision.js";

const s2s = {
  currency: "SGD",
  safeToSpend: 1200,
  projectedLowBalanceBeforeIncome: 900,
  breakdown: { protectedReserve: 6000 },
};
const twin = { liabilitiesTotal: 2500, essentialMonthlySpend: 2000, protectedAssets: 6000 };

test("an internal transfer leaves spendable money and the buffer untouched", () => {
  const im = buildMoveImpact({ safeToSpend: s2s, twin, kind: "internal_transfer", amount: 400 });
  assert.equal(im.movesOutOfSpendable, false);
  assert.equal(im.spendableNow.before, 1200);
  assert.equal(im.spendableNow.after, 1200);
  assert.equal(im.spendableNow.delta, 0);
  assert.equal(im.lowestBeforeIncome.after, 900);
  assert.equal(im.crossesSafetyLine, false);
  assert.equal(im.debt, null);
  assert.equal(im.emergencyBuffer.unchanged, true);
  assert.equal(im.emergencyBuffer.monthsBefore, 3); // 6000 / 2000
});

test("a card repayment takes cash out of spendable and pays down debt", () => {
  const im = buildMoveImpact({ safeToSpend: s2s, twin, kind: "card_repayment", amount: 500 });
  assert.equal(im.movesOutOfSpendable, true);
  assert.equal(im.spendableNow.after, 700);
  assert.equal(im.spendableNow.delta, -500);
  assert.equal(im.lowestBeforeIncome.after, 400);
  assert.equal(im.debt.before, 2500);
  assert.equal(im.debt.after, 2000);
  assert.equal(im.emergencyBuffer.unchanged, true);
});

test("a move that would take the low balance below zero flags crossesSafetyLine", () => {
  const im = buildMoveImpact({ safeToSpend: s2s, twin, kind: "card_repayment", amount: 1000 });
  assert.equal(im.lowestBeforeIncome.after, -100);
  assert.equal(im.crossesSafetyLine, true);
  assert.equal(im.spendableNow.after, 200); // clamped at >= 0
});

test("no essential-spend figure -> emergency months is null, not a fabricated number", () => {
  const im = buildMoveImpact({ safeToSpend: { safeToSpend: 500 }, twin: { protectedAssets: 3000 }, kind: "internal_transfer", amount: 100 });
  assert.equal(im.emergencyBuffer.monthsBefore, null);
});
