import test from "node:test";
import assert from "node:assert/strict";
import { computeSafetyRunway, rehearseShock, requiredRebuildForTarget } from "../lib/emergency/runway-finance.js";
import { projectRunwayImpact } from "../lib/emergency/runway-projector.js";
import { validateImpactSet } from "../lib/living-plan/studio-contract.js";
import { getFutureFieldAdapter } from "../lib/future-field/adapters.js";

const ctx = {
  monthlyExpenses: { value: 4000, provenance: "user_confirmed" },
  liquidAssets: { value: 22000, provenance: "bank_confirmed" },
  commitments: [
    { id: "loan:home", domain: "loan", label: "Home loan", monthlyAmount: 1600, essential: true },
    { id: "c1", domain: "wedding", label: "Wedding", monthlyAmount: 700, essential: false },
    { id: "c2", domain: "investment", label: "RSP", monthlyAmount: 400, essential: false },
  ],
};
const base = { monthly_expenses: 4000, current_savings: 22000, target_months: 6, floor_months: 3, monthly_contribution: 300 };

test("computeSafetyRunway: essential-month runway, per-commitment survivability, no double counting", () => {
  const r = computeSafetyRunway({ planData: base, context: ctx });
  assert.equal(r.available, true);
  // 22000 / (0.75*4000 essential + 1600 essential loan) = 22000 / 4600 ~= 4.8
  assert.ok(Math.abs(r.currentRunwayMonths - 4.8) < 0.2);
  // survivability is cumulative and essentials come first
  assert.equal(r.survivability[0].label, "Home loan");
  assert.ok(r.survivability[0].monthsSustainable >= r.survivability[1].monthsSustainable);
  assert.ok(r.assumptions.some((a) => /No double counting/i.test(a.text)));
});

test("SECTION M causal test: a bigger target raises the rebuild needed; other goals stay a ghost until allocated", () => {
  const t6 = requiredRebuildForTarget({ runway: computeSafetyRunway({ planData: base, context: ctx }), targetMonths: 6, byMonths: 24 });
  const t9 = requiredRebuildForTarget({ runway: computeSafetyRunway({ planData: { ...base, target_months: 9 }, context: ctx }), targetMonths: 9, byMonths: 24 });
  assert.ok(t9 > t6, "a larger target needs a larger monthly rebuild");

  const impact = projectRunwayImpact({ branchData: { ...base, monthly_contribution: 800 }, realityData: base, context: ctx });
  assert.equal(validateImpactSet(impact).ok, true);
  assert.ok(impact.affectedGoals.length >= 2);
  for (const g of impact.affectedGoals) {
    assert.equal(g.direction, "down", `${g.goalId} tightens under a bigger rebuild`);
    assert.equal(g.confirmedAfter, null, `${g.goalId} is only a possible impact until allocated`);
  }
  assert.equal(impact.allocationRequired, true);

  const placed = projectRunwayImpact({ branchData: { ...base, monthly_contribution: 800 }, realityData: base, context: ctx, allocation: { flexibleMonthly: 300 } });
  assert.notEqual(placed.affectedGoals[0].confirmedAfter, null, "an allocated leg becomes solid");
});

test("rehearseShock is PURE - it never mutates the plan, and reports a real recovery gradient", () => {
  const planCopy = { ...base };
  const r = computeSafetyRunway({ planData: planCopy, context: ctx });
  const reh = rehearseShock({ runway: r, shock: { incomeInterruptionMonths: 4, temporaryMonthlyExpense: 0, incomeRecoveryRatio: 1, monthlyIncome: 6500 } });
  assert.deepEqual(planCopy, base, "the plan object is untouched by a rehearsal");
  assert.ok(["holds", "dips_then_recovers", "needs_a_choice"].includes(reh.verdict));
  assert.ok(/unchanged/i.test(reh.note));
  if (reh.floorBreachMonth != null && reh.recoversByMonth != null) {
    assert.equal(reh.recoveryGradientMonths, reh.recoversByMonth - reh.floorBreachMonth);
  }
  assert.ok(Array.isArray(reh.survivedCommitments) && reh.survivedCommitments.length === ctx.commitments.length);
});

test("Quiet Zone: at or above target, the engine stops pushing more saving", () => {
  const fat = computeSafetyRunway({
    planData: { ...base, target_months: 6 },
    context: { ...ctx, liquidAssets: { value: 200000, provenance: "bank_confirmed" } },
  });
  assert.equal(fat.quietZone, true);
  assert.equal(fat.sealableReason, "already_above_target");
});

test("Unknown liquid assets stay FOG - the runway is not computed and never drawn as risk", () => {
  const r = computeSafetyRunway({
    planData: base,
    context: { ...ctx, liquidAssets: { value: null, provenance: "unknown" } },
  });
  assert.equal(r.currentRunwayMonths, null);
  assert.equal(r.liquidAssets.value, null);
  assert.equal(r.liquidAssets.provenance, "unknown");
  assert.ok(r.unknowns.includes("liquid_assets"));
});

test("Unknown monthly expenses -> the whole runway is unavailable, not a fabricated number", () => {
  const r = computeSafetyRunway({ planData: { ...base, monthly_expenses: 0 }, context: { ...ctx, monthlyExpenses: { value: 0, provenance: "unknown" } } });
  assert.equal(r.available, false);
  assert.equal(r.reason, "monthly_expenses_unknown");
});

test("emergencyAdapter exposes the runway + three domain pins + a cross-goal impactSet", () => {
  const adapter = getFutureFieldAdapter("emergency");
  const f = adapter.feasibility(base, { commitments: ctx.commitments });
  assert.ok(f.runway && f.runway.available);
  const m = adapter.constraintMetrics(base, f, {});
  assert.equal(typeof m.minimum_floor_months, "number");
  assert.equal(m.maximum_rebuild_monthly, 300);
  assert.equal(typeof m.no_goal_funding_below_floor, "boolean");
  const impact = adapter.projectImpacts({ ...base, monthly_contribution: 900 }, base, { commitments: ctx.commitments }, null);
  assert.equal(validateImpactSet(impact).ok, true);
});
