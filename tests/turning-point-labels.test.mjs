import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveTurningPoints } from "../lib/living-plan/turning-point.js";
import { OPEN_FUTURE_LABEL } from "../lib/life/turning-point-labels.js";

test("OPEN_FUTURE_LABEL covers every openFutures id turning-point.js can produce", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  const { points } = deriveTurningPoints({
    now,
    sources: {
      paymentMilestones: [{ commitmentId: "c1", domain: "wedding", label: "Deposit", amount: 3000, dueMonth: "2026-02", fundedByDue: false }],
      budgetGaps: [{ domain: "wedding", planId: "p1", gapAmount: 500 }],
      emergencyFloor: { bufferMonths: 2, floorMonths: 6, breachedByDomain: "home" },
      fragments: [{ branchId: "b1", domain: "investment", validUntil: "2026-01-20", state: "unclaimed" }],
      completions: [{ commitmentId: "c2", domain: "loan", endMonth: "2026-03", monthlyReleased: 400 }],
    },
  });
  assert.ok(points.length >= 5, "expected all five turning-point kinds to fire for this fixture");
  const allIds = new Set(points.flatMap((p) => p.openFutures ?? []));
  for (const id of allIds) {
    assert.ok(id in OPEN_FUTURE_LABEL, `missing a display label for openFutures id "${id}"`);
  }
});
