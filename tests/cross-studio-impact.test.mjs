import test from "node:test";
import assert from "node:assert/strict";
import { collectStudioImpacts, enrichCrossGoalEdges } from "../lib/life-thread/cross-studio-impact.js";

// A fake planStore - collectStudioImpacts only needs getCurrentPlanVersion.
function fakePlanStore(realityByPlanId) {
  return { getCurrentPlanVersion: async (planId) => ({ data: realityByPlanId[planId] ?? null }) };
}

test("collectStudioImpacts folds each Studio's unified impactSet into per-node ghost/solid magnitudes", async () => {
  const realityByPlanId = {
    "p-loan": { loan_amount: 40000, annual_rate_percent: 4.5, tenure_years: 7, monthly_installment: 555, extra_repayment: 0, monthly_income: 7000, monthly_expenses: 3800, current_savings: 25000 },
    "p-travel": { destination_type: "regional", comfort_tier: "mid", travellers: 2, nights: 8, trip_month: "2027-06", monthly_contribution: 300, current_savings: 4000, monthly_income: 7000, monthly_expenses: 3800 },
  };
  const branchesByPlan = [
    { plan: { domain: "loan", id: "p-loan" }, branches: [{ id: "b1", status: "open", data: { ...realityByPlanId["p-loan"], extra_repayment: 300 } }] },
    { plan: { domain: "travel", id: "p-travel" }, branches: [{ id: "b2", status: "open", data: { ...realityByPlanId["p-travel"], travellers: 4, nights: 16, comfort_tier: "premium" } }] },
    { plan: { domain: "home", id: "p-home" }, branches: [] }, // no open branch -> skipped
  ];

  const out = await collectStudioImpacts({
    branchesByPlan,
    planStore: fakePlanStore(realityByPlanId),
    threadContext: { monthlyIncome: 7000, monthlyExpenses: 3800, committedMonthlyTotal: 900, emergencyBufferMonths: 6, availableMonthlyCashflow: 1200 },
  });

  assert.equal(out.perStudio.length, 2, "two studios with an open draft contributed");
  assert.ok(out.studioCount === 2);
  // both branches add monthly pressure -> the totals carry it
  assert.ok(out.totals.addedPressureMonthly > 0);
  // pressure lands on near-term nodes as GHOST (nothing allocated)
  const nodes = out.nodeImpacts;
  assert.ok(Object.keys(nodes).length >= 2, "at least two life nodes affected");
  for (const v of Object.values(nodes)) {
    assert.ok(["ghost", "solid"].includes(v.state));
    assert.ok(["up", "down", "flat"].includes(v.direction));
  }
});

test("enrichCrossGoalEdges gives an edge a real magnitude + ghost/solid state when its target node is impacted", () => {
  const edges = [
    { from: "home", to: "safety", direction: "flat", basis: "deposit saving vs emergency floor" },
    { from: "freedom", to: "future", direction: "flat", basis: "near-term capital vs long-term" },
  ];
  const nodeImpacts = { safety: { ghostMonthly: -180, solidMonthly: 0, state: "ghost", direction: "down", sources: ["loan"] } };
  const enriched = enrichCrossGoalEdges(edges, nodeImpacts);
  const safetyEdge = enriched.find((e) => e.to === "safety");
  assert.equal(safetyEdge.direction, "down");
  assert.equal(safetyEdge.impactState, "ghost");
  assert.equal(safetyEdge.magnitudeMonthly, 180);
  const otherEdge = enriched.find((e) => e.to === "future");
  assert.equal(otherEdge.impactState, "none");
});
