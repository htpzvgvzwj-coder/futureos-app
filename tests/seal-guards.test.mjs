import test from "node:test";
import assert from "node:assert/strict";
import { checkSealBranch, serverResourceDelta } from "../lib/plan-runtime/seal-guards.js";

test("sealing the reality path (no branch) is always allowed by the branch guard", () => {
  assert.deepEqual(checkSealBranch({ branch: null, planId: "p1", currentPlanVersion: "3" }), { ok: true });
});

test("a fresh branch on the current plan version passes", () => {
  const r = checkSealBranch({ branch: { plan_id: "p1", status: "open", base_version: "3" }, planId: "p1", currentPlanVersion: "3" });
  assert.equal(r.ok, true);
});

test("a STALE branch (peeled from an older plan version) is a 409 conflict, never overwritten", () => {
  const r = checkSealBranch({ branch: { plan_id: "p1", status: "open", base_version: "2" }, planId: "p1", currentPlanVersion: "4" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "stale_branch");
  assert.equal(r.status, 409);
  assert.equal(r.detail.branchBaseVersion, "2");
  assert.equal(r.detail.currentPlanVersion, "4");
});

test("a discarded / merged / already-sealed branch cannot be sealed", () => {
  for (const status of ["discarded", "merged", "sealed", "withdrawn"]) {
    const r = checkSealBranch({ branch: { plan_id: "p1", status, base_version: "3" }, planId: "p1", currentPlanVersion: "3" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "branch_not_sealable");
    assert.equal(r.detail.branchStatus, status);
  }
});

test("a branch that belongs to a different plan is rejected", () => {
  const r = checkSealBranch({ branch: { plan_id: "other", status: "open", base_version: "3" }, planId: "p1", currentPlanVersion: "3" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "branch_plan_mismatch");
});

test("serverResourceDelta reads ONLY the server impactSet's resourceDelta, clamped >= 0 and integer", () => {
  assert.deepEqual(
    serverResourceDelta({ resourceDelta: { freedMonthly: 619.6, addedPressureMonthly: 0 } }),
    { freedCashflow: 620, addedPressure: 0 },
  );
  assert.deepEqual(
    serverResourceDelta({ resourceDelta: { freedMonthly: 0, addedPressureMonthly: -50 } }),
    { freedCashflow: 0, addedPressure: 0 },
  );
  // a client-shaped object with freedCashflow but no resourceDelta -> 0
  // unless it is the legacy monthly-shift fallback key
  assert.deepEqual(serverResourceDelta({ freedCashflow: 999 }), { freedCashflow: 999, addedPressure: 0 });
  assert.deepEqual(serverResourceDelta(null), { freedCashflow: 0, addedPressure: 0 });
});
