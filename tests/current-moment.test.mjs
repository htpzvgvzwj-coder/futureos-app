import test from "node:test";
import assert from "node:assert/strict";
import { resolveCurrentMoment, impactSourceBranchId, momentDrivesLifeThread, MOMENT_STATES } from "../lib/living-plan/current-moment.js";
import { collectStudioImpacts } from "../lib/life-thread/cross-studio-impact.js";

test("the four moment states are explicit", () => {
  assert.deepEqual(MOMENT_STATES, ["reality", "activeBranch", "alternatives", "sealedBranch"]);
});

test("no branches -> reality; reality drives the Life Thread but has no branch overlay", () => {
  const m = resolveCurrentMoment({ branches: [] });
  assert.equal(m.state, "reality");
  assert.equal(impactSourceBranchId(m), null);
  assert.equal(momentDrivesLifeThread(m), true);
});

test("exactly one 'active' branch -> activeBranch; the rest are alternatives (compare only)", () => {
  const m = resolveCurrentMoment({
    branches: [
      { id: "a", status: "open" },
      { id: "b", status: "active" },
      { id: "c", status: "open" },
      { id: "d", status: "discarded" },
    ],
  });
  assert.equal(m.state, "activeBranch");
  assert.equal(m.branchId, "b");
  assert.deepEqual(m.alternativeBranchIds.sort(), ["a", "c"]);
  assert.equal(impactSourceBranchId(m), "b");
});

test("several OPEN branches but none activated -> alternatives; NOTHING drives the Life Thread", () => {
  const m = resolveCurrentMoment({ branches: [{ id: "a", status: "open" }, { id: "b", status: "open" }] });
  assert.equal(m.state, "alternatives");
  assert.equal(m.branchId, null);
  assert.equal(impactSourceBranchId(m), null);
  assert.equal(momentDrivesLifeThread(m), false);
});

test("a single open branch is treated as the active moment (nothing to disambiguate)", () => {
  const m = resolveCurrentMoment({ branches: [{ id: "only", status: "open" }] });
  assert.equal(m.state, "activeBranch");
  assert.equal(m.branchId, "only");
});

test("a sealed commitment -> sealedBranch (which IS reality now); it drives the thread", () => {
  const m = resolveCurrentMoment({ branches: [{ id: "a", status: "open" }], sealedCommitment: { id: "c1", plan_branch_id: "a" } });
  assert.equal(m.state, "sealedBranch");
  assert.equal(m.commitmentId, "c1");
  assert.equal(impactSourceBranchId(m), null, "sealed = reality, no branch overlay");
  assert.equal(momentDrivesLifeThread(m), true);
});

test("SPEC: two opposite Wedding branches - only the ACTIVE one moves Home / Emergency", async () => {
  const REALITY = {
    "p-wed": {
      wedding_date: "2027-06", guest_count: 150, venue_tier: "mid_range", venue_type: "hotel",
      photography_tier: "mid", attire_tier: "mid", monthly_contribution: 800, partner_contribution: 400, current_savings: 6000,
    },
  };
  const planStore = { getCurrentPlanVersion: async () => ({ data: REALITY["p-wed"] }) };
  const threadContext = { monthlyIncome: 8000, monthlyExpenses: 3800, committedMonthlyTotal: 900, emergencyBufferMonths: 6, availableMonthlyCashflow: 1500 };

  // branch A = much smaller wedding (frees a lot); branch B = much bigger (adds pressure).
  const branchA = { id: "wed-small", status: "open", data: { ...REALITY["p-wed"], guest_count: 60 } };
  const branchB = { id: "wed-big", status: "open", data: { ...REALITY["p-wed"], guest_count: 260, venue_tier: "premium" } };

  // With BOTH just open (no activation) -> nothing moves.
  let out = await collectStudioImpacts({ branchesByPlan: [{ plan: { domain: "wedding", id: "p-wed" }, branches: [branchA, branchB] }], planStore, threadContext });
  assert.equal(out.moments.wedding.state, "alternatives");
  assert.equal(out.perStudio.length, 0, "two open alternatives -> Home/Emergency untouched");

  // Activate the SMALLER one -> it (and only it) drives the thread: freed cashflow.
  out = await collectStudioImpacts({ branchesByPlan: [{ plan: { domain: "wedding", id: "p-wed" }, branches: [{ ...branchA, status: "active" }, branchB] }], planStore, threadContext });
  assert.equal(out.moments.wedding.state, "activeBranch");
  assert.equal(out.perStudio[0].branchId, "wed-small");
  assert.ok(out.monthlyResourceTotals.freedMonthly > 0);
  assert.equal(out.monthlyResourceTotals.addedPressureMonthly, 0, "the BIG alternative did NOT add its pressure");

  // Activate the BIGGER one instead -> now pressure, and the small one is inert.
  out = await collectStudioImpacts({ branchesByPlan: [{ plan: { domain: "wedding", id: "p-wed" }, branches: [branchA, { ...branchB, status: "active" }] }], planStore, threadContext });
  assert.equal(out.perStudio[0].branchId, "wed-big");
  assert.ok(out.monthlyResourceTotals.addedPressureMonthly > 0);
  assert.equal(out.monthlyResourceTotals.freedMonthly, 0);
});
