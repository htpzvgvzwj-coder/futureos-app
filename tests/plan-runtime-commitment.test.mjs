import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCommitmentAmount,
  buildAdjustedSavingsPlanPayload,
  buildRevertSavingsPlanPayload,
  deriveCommittedMonthlyOutflow,
} from "../lib/plan-runtime/commitment.js";

test("validateCommitmentAmount accepts an in-range amount that fits cashflow", () => {
  const result = validateCommitmentAmount({
    monthlyContribution: 1200,
    sliderMin: 800,
    sliderMax: 1600,
    availableMonthlyCashflow: 2000,
  });
  assert.deepEqual(result, { ok: true, error: null });
});

test("validateCommitmentAmount rejects a non-positive / NaN amount", () => {
  assert.equal(validateCommitmentAmount({ monthlyContribution: 0, sliderMin: 100, sliderMax: 900 }).error, "invalid_amount");
  assert.equal(validateCommitmentAmount({ monthlyContribution: Number.NaN, sliderMin: 100, sliderMax: 900 }).error, "invalid_amount");
});

test("validateCommitmentAmount rejects amounts outside the slider range (beyond the step tolerance)", () => {
  assert.equal(
    validateCommitmentAmount({ monthlyContribution: 700, sliderMin: 800, sliderMax: 1600 }).error,
    "amount_out_of_range",
  );
  assert.equal(
    validateCommitmentAmount({ monthlyContribution: 1650, sliderMin: 800, sliderMax: 1600 }).error,
    "amount_out_of_range",
  );
  // Exactly at max, and one step over max, are both allowed.
  assert.equal(validateCommitmentAmount({ monthlyContribution: 1600, sliderMin: 800, sliderMax: 1600 }).ok, true);
  assert.equal(validateCommitmentAmount({ monthlyContribution: 1610, sliderMin: 800, sliderMax: 1600 }).ok, true);
});

test("validateCommitmentAmount rejects an amount larger than real monthly headroom", () => {
  const result = validateCommitmentAmount({
    monthlyContribution: 1500,
    sliderMin: 800,
    sliderMax: 1600,
    availableMonthlyCashflow: 1200,
  });
  assert.equal(result.error, "amount_exceeds_cashflow");
});

test("validateCommitmentAmount skips the cashflow check when no real income figure is available", () => {
  const result = validateCommitmentAmount({
    monthlyContribution: 1500,
    sliderMin: 800,
    sliderMax: 1600,
    availableMonthlyCashflow: null,
  });
  assert.equal(result.ok, true);
});

test("buildAdjustedSavingsPlanPayload carries the amount into contribution and allocation", () => {
  const payload = buildAdjustedSavingsPlanPayload({
    priorPlan: { target_complete_month: "2030-06", monthly_contribution: 900 },
    monthlyContribution: 1300,
    effectiveMonth: "2026-10",
    readyMonth: "2029-11",
    notes: "note",
  });
  assert.equal(payload.monthly_contribution, 1300);
  assert.equal(payload.allocation.reduce((sum, a) => sum + a.monthly_amount, 0), 1300);
  assert.equal(payload.start_month, "2026-10");
  assert.equal(payload.target_complete_month, "2029-11");
  assert.equal(payload.adjusted_by, "goal_commitment");
});

test("buildAdjustedSavingsPlanPayload falls back to the prior target month when no ready date", () => {
  const payload = buildAdjustedSavingsPlanPayload({
    priorPlan: { target_complete_month: "2030-06" },
    monthlyContribution: 1300,
    effectiveMonth: "2026-10",
    readyMonth: null,
    notes: "note",
  });
  assert.equal(payload.target_complete_month, "2030-06");
});

test("buildRevertSavingsPlanPayload restores the pre-commitment plan verbatim with provenance", () => {
  const superseded = {
    strategy_id: "balanced",
    monthly_contribution: 900,
    allocation: [{ vehicle: "savingsAccount", monthly_amount: 900 }],
    start_month: "2025-01",
    target_complete_month: "2030-06",
    notes: "original",
  };
  const payload = buildRevertSavingsPlanPayload({ supersededPlan: superseded, notes: "restored" });
  assert.equal(payload.monthly_contribution, 900);
  assert.equal(payload.start_month, "2025-01");
  assert.equal(payload.target_complete_month, "2030-06");
  assert.equal(payload.notes, "restored");
  assert.equal(payload.restored_from, "goal_commitment_revoke");
  assert.equal(payload.adjusted_by, undefined);
});

test("buildRevertSavingsPlanPayload returns null when there is no snapshot to restore", () => {
  assert.equal(buildRevertSavingsPlanPayload({ supersededPlan: null, notes: "x" }), null);
});

test("deriveCommittedMonthlyOutflow counts an active commitment at face value", () => {
  assert.equal(
    deriveCommittedMonthlyOutflow({ commitment: { monthly_contribution: "1300" }, executionState: "active" }),
    1300,
  );
});

test("deriveCommittedMonthlyOutflow counts a paused or revoked commitment as zero outflow", () => {
  assert.equal(
    deriveCommittedMonthlyOutflow({ commitment: { monthly_contribution: "1300" }, executionState: "paused" }),
    0,
  );
  assert.equal(
    deriveCommittedMonthlyOutflow({ commitment: { monthly_contribution: "1300" }, executionState: "revoked" }),
    0,
  );
});

test("deriveCommittedMonthlyOutflow is zero when there is no commitment", () => {
  assert.equal(deriveCommittedMonthlyOutflow({ commitment: null, executionState: "active" }), 0);
});
