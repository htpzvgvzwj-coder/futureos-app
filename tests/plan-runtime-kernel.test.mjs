import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_STATES,
  canTransition,
  assertTransition,
  isRealState,
  ledgerStatusForPlanState,
  allowedTransitions,
} from "../lib/plan-runtime/state-machine.js";
import {
  nextVersion,
  buildPlanVersion,
  rollUpConfidence,
  diffPlanData,
  mergeBranchData,
  isRealEvidence,
} from "../lib/plan-runtime/plan-model.js";
import {
  peelBranch,
  compareBranches,
  mergeBranches,
  solveMonthlyForTargetMonths,
  checkConstraints,
  buildSealPreview,
  compareRealityToCommitted,
} from "../lib/plan-runtime/future-field.js";
import { rankUnknowns, computePlanCertainty, isOpenUnknown, reasonForUnknown } from "../lib/plan-runtime/evidence-radar.js";
import { reconcileSavingsRow } from "../lib/plan-runtime/commitment.js";

// -------------------------------------------------------------------------
// state machine
// -------------------------------------------------------------------------

test("state machine: the happy path draft->...->handed_over is fully connected", () => {
  const path = ["draft", "proposed", "scheduled", "active", "completed", "handed_over"];
  for (let i = 0; i < path.length - 1; i += 1) {
    assert.equal(canTransition(path[i], path[i + 1], null), true, `${path[i]} -> ${path[i + 1]}`);
  }
});

test("state machine: real vs non-real states", () => {
  for (const s of ["draft", "shadow", "proposed"]) assert.equal(isRealState(s), false);
  for (const s of ["scheduled", "active", "paused", "rescued", "completed", "handed_over", "revoked"]) {
    assert.equal(isRealState(s), true);
  }
});

test("state machine: illegal and terminal transitions throw typed errors", () => {
  assert.throws(() => assertTransition("draft", "active", null), /illegal_transition/);
  assert.throws(() => assertTransition("revoked", "active", null), /plan_is_terminal/);
  assert.throws(() => assertTransition("active", "banana", null), /unknown_target_state/);
});

test("state machine: actor permissions - only guardian/system/user can pause an active plan, partner cannot", () => {
  assert.equal(canTransition("active", "paused", "guardian"), true);
  assert.equal(canTransition("active", "paused", "system"), true);
  assert.equal(canTransition("active", "paused", "user"), true);
  assert.equal(canTransition("active", "paused", "partner"), false);
  assert.throws(() => assertTransition("active", "paused", "partner"), /actor_not_permitted/);
});

test("state machine: a joint change routes through needs_approval and back", () => {
  assert.equal(canTransition("active", "needs_approval", "system"), true);
  assert.equal(canTransition("needs_approval", "scheduled", "partner"), true);
  assert.equal(canTransition("needs_approval", "revoked", "partner"), true);
});

test("state machine: ledger status mapping never invents an actual status for a non-real plan state", () => {
  assert.equal(ledgerStatusForPlanState("draft"), "projected");
  assert.equal(ledgerStatusForPlanState("shadow"), "simulated");
  assert.equal(ledgerStatusForPlanState("scheduled"), "scheduled");
  assert.equal(ledgerStatusForPlanState("active"), "active");
  assert.equal(ledgerStatusForPlanState("paused"), "paused");
  assert.equal(ledgerStatusForPlanState("completed"), "completed");
});

test("state machine: every PLAN_STATE is reachable as a transition target or is the initial state", () => {
  const targets = new Set(["draft"]);
  for (const from of PLAN_STATES) for (const to of allowedTransitions(from)) targets.add(to);
  for (const s of PLAN_STATES) assert.ok(targets.has(s), `${s} unreachable`);
});

// -------------------------------------------------------------------------
// plan model
// -------------------------------------------------------------------------

test("plan model: versions are immutable-chained with supersedes links", () => {
  const v1 = buildPlanVersion({ base: null, patch: { price: 500000 }, evidence: [] });
  assert.equal(v1.version, "1");
  assert.equal(v1.supersedesVersion, null);
  const v2 = buildPlanVersion({ base: v1, patch: { price: 480000 }, evidence: [] });
  assert.equal(v2.version, "2");
  assert.equal(v2.supersedesVersion, "1");
  assert.equal(v2.data.price, 480000);
  assert.equal(nextVersion("2"), "3");
});

test("plan model: confidence rolls up from evidence truthfulness, not asserted", () => {
  assert.equal(rollUpConfidence([]).confidence, "low");
  assert.equal(
    rollUpConfidence([
      { truthfulness: "confirmed" },
      { truthfulness: "real_quote" },
      { truthfulness: "paid" },
    ]).confidence,
    "high",
  );
  const mixed = rollUpConfidence([{ truthfulness: "real_quote" }, { truthfulness: "estimate" }, { truthfulness: "estimate" }]);
  assert.equal(mixed.confidence, "medium");
  const missing = rollUpConfidence([{ truthfulness: "confirmed", required: true, value: null }]);
  assert.equal(missing.confidence, "low");
  assert.equal(missing.uncertaintyNote, "key_evidence_missing");
});

test("plan model: isRealEvidence gate", () => {
  assert.equal(isRealEvidence("estimate"), false);
  assert.equal(isRealEvidence("market_range"), false);
  assert.equal(isRealEvidence("real_quote"), true);
  assert.equal(isRealEvidence("paid"), true);
});

test("plan model: diffPlanData returns only changed fields, rounded", () => {
  const d = diffPlanData({ a: 1, b: 2.005, c: "x" }, { a: 1, b: 3.14159, c: "y" });
  assert.deepEqual(d.changedKeys.sort(), ["b", "c"]);
  assert.equal(d.after.b, 3.14);
});

test("plan model: mergeBranchData respects an explicit pick map (Future Field Merge)", () => {
  const merged = mergeBranchData({ venue: "A-hall", date: "2028-10" }, { venue: "B-garden", date: "2028-06" }, { venue: "b", date: "a" });
  assert.deepEqual(merged, { venue: "B-garden", date: "2028-10" });
});

// -------------------------------------------------------------------------
// future field
// -------------------------------------------------------------------------

test("future field: Peel produces branch data + minimal delta + real feasibility", () => {
  const base = { price: 500000, tenureYears: 25 };
  const out = peelBranch({
    baseData: base,
    overrides: { price: 450000 },
    feasibilityFn: (data) => ({ monthly: Math.round(data.price / 300) }),
  });
  assert.equal(out.data.price, 450000);
  assert.deepEqual(out.delta.changedKeys, ["price"]);
  assert.equal(out.feasibility.monthly, 1500);
});

test("future field: compareBranches builds a metric table", () => {
  const table = compareBranches(
    [
      { label: "sooner", data: { months: 48 } },
      { label: "cheaper", data: { months: 72 } },
    ],
    { months: (d) => d.months, years: (d) => Math.round(d.months / 12) },
  );
  assert.deepEqual(table.metrics, ["months", "years"]);
  assert.equal(table.rows[0].values.years, 4);
});

test("future field: Bend inverts a monotonic projector to solve the monthly amount for a moved date", () => {
  // reality: months-to-ready = ceil(120000 / monthly), capped
  const projectMonthsFn = (monthly) => (monthly <= 0 ? null : Math.ceil(120000 / monthly));
  const solved = solveMonthlyForTargetMonths({ targetMonths: 24, projectMonthsFn, highAmount: 20000 });
  assert.equal(solved.achievable, true);
  assert.ok(solved.amount >= 5000 && solved.amount <= 5200, `got ${solved.amount}`);
  assert.ok(solved.projectedMonths <= 24);

  const impossible = solveMonthlyForTargetMonths({ targetMonths: 1, projectMonthsFn, highAmount: 20000 });
  assert.equal(impossible.achievable, false);
});

test("future field: Pin check reports real gaps against constraints", () => {
  const constraints = [
    { kind: "emergency_floor_months", operator: "gte", value: 6 },
    { kind: "max_monthly_contribution", operator: "lte", value: 1500 },
    { kind: "no_guardian_auto_move", operator: "flag", value: 1 },
  ];
  const res = checkConstraints(constraints, {
    emergency_floor_months: 5.4,
    max_monthly_contribution: 1800,
    no_guardian_auto_move: true,
  });
  assert.equal(res.ok, false);
  assert.equal(res.violations.length, 3);
  const floor = res.violations.find((v) => v.kind === "emergency_floor_months");
  assert.equal(floor.gap, -0.6);
});

test("future field: Pin check can't-evaluate is a gap, not a violation", () => {
  const res = checkConstraints([{ kind: "min_core_guests", operator: "gte", value: 40 }], {});
  assert.equal(res.ok, true);
  assert.equal(res.violations.length, 0);
});

test("future field: Seal preview states execution honesty and pin compliance", () => {
  const preview = buildSealPreview({
    branch: { label: "June wedding", feasibility: { sources: ["asset ledger", "MAS rates"], assumptions: ["3.5% rate"] } },
    planDomain: "wedding",
    monthlyAmount: 1050,
    effectiveMonth: "2026-10",
    readyMonth: "2028-05",
    constraintCheck: { ok: true, violations: [] },
    isShadowOnly: true,
  });
  assert.equal(preview.execution, "shadow_only");
  assert.equal(preview.reversible, true);
  assert.equal(preview.respectsPins, true);
  assert.equal(preview.amount, 1050);
});

test("future field: Catch-up classifies approaching vs separating vs paused", () => {
  const projectFn = (savings, monthly) => (monthly <= 0 ? null : Math.ceil((120000 - savings) / monthly));
  const base = {
    committed: { monthlyContribution: 1000, startMonth: "2026-01", targetMonth: "2033-01", downPaymentNeeded: 120000, currentSavingsAtStart: 20000 },
    currentSavingsNow: 26000,
    projectFn,
    now: new Date("2026-07-15"),
  };
  const approaching = compareRealityToCommitted({
    ...base,
    realityCheckins: [
      { month: "2026-01", amount: 1000 },
      { month: "2026-02", amount: 1100 },
      { month: "2026-03", amount: 1000 },
    ],
  });
  assert.equal(approaching.status, "approaching");

  const separating = compareRealityToCommitted({
    ...base,
    realityCheckins: [
      { month: "2026-01", amount: 400 },
      { month: "2026-02", amount: 300 },
    ],
  });
  assert.equal(separating.status, "separating");
  assert.ok(separating.shortfall > 0);

  const paused = compareRealityToCommitted({
    ...base,
    realityCheckins: [{ month: "2026-01", amount: 1000 }],
    pausedConstraint: { kind: "emergency_floor_months" },
  });
  assert.equal(paused.status, "paused");
  assert.equal(paused.pausedByPin, "emergency_floor_months");
});

// -------------------------------------------------------------------------
// evidence radar
// -------------------------------------------------------------------------

test("evidence radar: ranks required-missing above high-impact estimates", () => {
  const rows = [
    { field: "venue_cost", label: "Venue cost", truthfulness: "estimate", impact_weight: 90, required: false, value: 15000 },
    { field: "guest_count", label: "Guest count", truthfulness: "estimate", impact_weight: 50, required: true, value: null },
    { field: "catering", label: "Catering", truthfulness: "market_range", impact_weight: 30, required: false, value: null },
  ];
  const ranked = rankUnknowns(rows, { max: 3 });
  assert.equal(ranked[0].field, "guest_count");
  assert.equal(ranked[0].reason, "blocks_feasibility");
  assert.equal(ranked[1].field, "venue_cost");
});

test("evidence radar: a real confirmed value with no weight is not an open unknown", () => {
  const row = { field: "deposit", truthfulness: "confirmed", impact_weight: 0, required: false, value: 3000 };
  assert.equal(isOpenUnknown(row), false);
});

test("evidence radar: an expired quote reopens as an unknown", () => {
  const row = { field: "venue_cost", truthfulness: "real_quote", impact_weight: 80, required: true, value: 15800, valid_until: "2020-01-01" };
  assert.equal(isOpenUnknown(row, new Date("2026-08-29")), true);
  assert.equal(reasonForUnknown(row, new Date("2026-08-29")), "quote_expired");
});

test("evidence radar: certainty summary counts open vs settled", () => {
  const rows = [
    { field: "a", truthfulness: "confirmed", impact_weight: 10, required: true, value: 1 },
    { field: "b", truthfulness: "estimate", impact_weight: 40, required: false, value: null },
    { field: "c", truthfulness: "paid", impact_weight: 0, required: false, value: 2 },
  ];
  const cert = computePlanCertainty(rows);
  assert.equal(cert.openUnknownCount, 1);
  assert.equal(cert.settledCount, 2);
  assert.equal(cert.totalTracked, 3);
});

// -------------------------------------------------------------------------
// commitment reconcile (Phase 1 downstream propagation)
// -------------------------------------------------------------------------

test("reconcileSavingsRow: paused commitment substitutes 0 and keeps the raw amount for display", () => {
  const row = { domain: "home", monthlyContribution: 1300, confirmedAt: "2026-08-01" };
  const out = reconcileSavingsRow(row, { countedMonthlyOutflow: 0, executionState: "paused" });
  assert.equal(out.monthlyContribution, 0);
  assert.equal(out.rawMonthlyContribution, 1300);
  assert.equal(out.commitmentExecutionState, "paused");
});

test("reconcileSavingsRow: active commitment matching the artifact is untouched", () => {
  const row = { domain: "home", monthlyContribution: 1300 };
  const out = reconcileSavingsRow(row, { countedMonthlyOutflow: 1300, executionState: "active" });
  assert.equal(out, row);
});

test("reconcileSavingsRow: no resolution passes through", () => {
  const row = { domain: "wedding", monthlyContribution: 800 };
  assert.equal(reconcileSavingsRow(row, null), row);
});
