import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyAllocation,
  normalizeAllocation,
  allocationSum,
  validateAllocation,
  isAllocationSet,
  isFullyAllocated,
  allToLeg,
} from "../lib/living-plan/allocation.js";
import {
  FRAGMENT_STATES,
  FRAGMENT_STATES_V2,
  deriveFutureFragment,
  deriveFutureFragmentV2,
  fragmentIsActionable,
} from "../lib/living-plan/future-fragment.js";

test("allocation: normalize clamps negatives/NaN to 0", () => {
  const a = normalizeAllocation({ goalMonthly: -5, emergencyMonthly: "x", flexibleMonthly: 120 });
  assert.deepEqual(a, { goalMonthly: 0, emergencyMonthly: 0, flexibleMonthly: 120 });
});

test("allocation: sum + set detection", () => {
  assert.equal(allocationSum(emptyAllocation()), 0);
  assert.equal(isAllocationSet(emptyAllocation()), false);
  assert.equal(isAllocationSet({ flexibleMonthly: 50 }), true);
});

test("allocation: validate rejects over-allocation, allows under-allocation as 'available'", () => {
  const over = validateAllocation({ freedCashflow: 300, allocation: { goalMonthly: 200, emergencyMonthly: 200 } });
  assert.equal(over.ok, false);
  assert.equal(over.error, "over_allocated");

  const under = validateAllocation({ freedCashflow: 300, allocation: { goalMonthly: 100 } });
  assert.equal(under.ok, true);
  assert.equal(under.unallocated, 200);

  const none = validateAllocation({ freedCashflow: 0, allocation: { goalMonthly: 10 } });
  assert.equal(none.ok, false);
  assert.equal(none.error, "nothing_freed");
});

test("allocation: isFullyAllocated + allToLeg", () => {
  assert.equal(isFullyAllocated({ freedCashflow: 300, allocation: { goalMonthly: 300 } }), true);
  assert.equal(isFullyAllocated({ freedCashflow: 300, allocation: { goalMonthly: 100 } }), false);
  assert.deepEqual(allToLeg("emergency", 250), { goalMonthly: 0, emergencyMonthly: 250, flexibleMonthly: 0 });
  assert.deepEqual(allToLeg("goal", 250), { goalMonthly: 250, emergencyMonthly: 0, flexibleMonthly: 0 });
});

test("future-fragment: no released resource -> no fragment", () => {
  assert.equal(deriveFutureFragment({ branch: { id: "b1" }, projectedImpacts: { mode: "pressure" } }), null);
  assert.equal(deriveFutureFragment({ branch: { id: "b1" }, projectedImpacts: { mode: "freed", freedCashflow: 0 } }), null);
});

test("future-fragment: unclaimed -> allocated -> committed states derive from branch + seal", () => {
  const proj = { mode: "freed", freedCashflow: 300, availableImpact: {}, allocatedImpact: null };

  const unclaimed = deriveFutureFragment({ branch: { id: "b1", data: {} }, projectedImpacts: proj });
  assert.equal(unclaimed.state, "unclaimed");
  assert.equal(unclaimed.unallocatedMonthly, 300);
  assert.ok(fragmentIsActionable(unclaimed));

  const allocated = deriveFutureFragment({
    branch: { id: "b1", data: { allocation: { goalMonthly: 200 } } },
    projectedImpacts: proj,
  });
  assert.equal(allocated.state, "allocated");
  assert.equal(allocated.unallocatedMonthly, 100);

  const committed = deriveFutureFragment({
    branch: { id: "b1", status: "sealed", data: { allocation: { goalMonthly: 300 } } },
    projectedImpacts: proj,
  });
  assert.equal(committed.state, "committed");
  assert.equal(fragmentIsActionable(committed), false);

  const revoked = deriveFutureFragment({
    branch: { id: "b1", data: { allocation: { goalMonthly: 300 } } },
    projectedImpacts: proj,
    sealedCommitment: { status: "revoked" },
  });
  assert.equal(revoked.state, "revoked");
});

test("future-fragment: every state string is in FRAGMENT_STATES", () => {
  for (const s of ["unclaimed", "allocated", "committed", "revoked", "handed_off", "expired"]) {
    assert.ok(FRAGMENT_STATES.includes(s));
  }
});

// ---- Future Fragment V2 state machine (Part A4) ----------------------

test("fragment V2: no released resource -> no fragment", () => {
  assert.equal(deriveFutureFragmentV2({ freedMonthly: 0, addedPressureMonthly: 0 }), null);
});

test("fragment V2: possible -> placed -> sealed as the customer routes then Seals", () => {
  const base = { branch: { id: "b1", data: {} }, freedMonthly: 300 };

  const possible = deriveFutureFragmentV2({ ...base });
  assert.equal(possible.state, "possible");
  assert.equal(possible.placedMonthly, 0);
  assert.equal(possible.unplacedMonthly, 300);
  assert.equal(possible.isGhost, true);
  assert.equal(possible.confirmedMonthly, 0);

  const placed = deriveFutureFragmentV2({ ...base, allocation: { emergencyMonthly: 200 } });
  assert.equal(placed.state, "placed");
  assert.equal(placed.placedMonthly, 200);
  assert.equal(placed.unplacedMonthly, 100);
  assert.equal(placed.isGhost, true, "placed is still a Ghost - nothing moved");
  assert.equal(placed.confirmedMonthly, 0);

  const sealed = deriveFutureFragmentV2({
    branch: { id: "b1", status: "sealed", data: {} },
    freedMonthly: 300,
    allocation: { emergencyMonthly: 200 },
    sealedCommitment: { id: "c1", status: "active" },
  });
  assert.equal(sealed.state, "sealed");
  assert.equal(sealed.confirmedMonthly, 200, "the placed leg is now Solid");
  assert.equal(sealed.unplacedMonthly, 100, "the remainder stays flexible");
  assert.equal(sealed.isGhost, false);
});

test("fragment V2: revoke falls back; expiry only bites an un-routed, un-sealed fragment", () => {
  const revoked = deriveFutureFragmentV2({
    branch: { id: "b1", data: {} },
    freedMonthly: 300,
    allocation: { emergencyMonthly: 300 },
    sealedCommitment: { status: "revoked" },
  });
  assert.equal(revoked.state, "revoked");

  const expired = deriveFutureFragmentV2({
    branch: { id: "b1", data: { fragment_valid_until: "2020-01-01" } },
    freedMonthly: 300,
    now: new Date("2026-01-01"),
  });
  assert.equal(expired.state, "expired");

  const stillPlaced = deriveFutureFragmentV2({
    branch: { id: "b1", data: { fragment_valid_until: "2020-01-01" } },
    freedMonthly: 300,
    allocation: { emergencyMonthly: 300 },
    now: new Date("2026-01-01"),
  });
  assert.equal(stillPlaced.state, "placed", "a routed fragment does not silently expire");
});

test("fragment V2: every state string is in FRAGMENT_STATES_V2", () => {
  for (const s of ["possible", "placed", "sealed", "released", "revoked", "expired"]) {
    assert.ok(FRAGMENT_STATES_V2.includes(s));
  }
});
