import test from "node:test";
import assert from "node:assert/strict";
import { collectStudioImpacts, enrichCrossGoalEdges } from "../lib/life-thread/cross-studio-impact.js";

// A fake planStore - collectStudioImpacts only needs getCurrentPlanVersion.
function fakePlanStore(realityByPlanId) {
  return { getCurrentPlanVersion: async (planId) => ({ data: realityByPlanId[planId] ?? null }) };
}

const REALITY = {
  "p-loan": { loan_amount: 40000, annual_rate_percent: 4.5, tenure_years: 7, monthly_installment: 555, extra_repayment: 0, monthly_income: 7000, monthly_expenses: 3800, current_savings: 25000 },
  "p-travel": { destination_type: "regional", comfort_tier: "mid", travellers: 2, nights: 8, trip_month: "2027-06", monthly_contribution: 300, current_savings: 4000, monthly_income: 7000, monthly_expenses: 3800 },
};
const THREAD_CTX = { monthlyIncome: 7000, monthlyExpenses: 3800, committedMonthlyTotal: 900, emergencyBufferMonths: 6, availableMonthlyCashflow: 1200 };

test("only the ACTIVE branch of a plan drives the Life Thread - open alternatives are ignored", async () => {
  const branchesByPlan = [
    {
      plan: { domain: "travel", id: "p-travel" },
      branches: [
        { id: "b-cheap", status: "open", data: { ...REALITY["p-travel"], travellers: 1, nights: 3 } }, // alternative
        { id: "b-lux", status: "active", data: { ...REALITY["p-travel"], travellers: 4, nights: 16, comfort_tier: "premium" } }, // active
      ],
    },
  ];
  const out = await collectStudioImpacts({ branchesByPlan, planStore: fakePlanStore(REALITY), threadContext: THREAD_CTX });
  assert.equal(out.perStudio.length, 1, "one studio contributed");
  assert.equal(out.perStudio[0].branchId, "b-lux", "the ACTIVE branch, not the cheaper alternative");
  assert.equal(out.moments.travel.state, "activeBranch");
  assert.deepEqual(out.moments.travel.alternativeBranchIds, ["b-cheap"]);
  // the lux branch adds pressure
  assert.ok(out.monthlyResourceTotals.addedPressureMonthly > 0);
});

test("a plan with only open alternatives (none activated) does NOT move any other Studio", async () => {
  const branchesByPlan = [
    {
      plan: { domain: "travel", id: "p-travel" },
      branches: [
        { id: "b1", status: "open", data: { ...REALITY["p-travel"], nights: 3 } },
        { id: "b2", status: "open", data: { ...REALITY["p-travel"], nights: 20 } },
      ],
    },
  ];
  const out = await collectStudioImpacts({ branchesByPlan, planStore: fakePlanStore(REALITY), threadContext: THREAD_CTX });
  assert.equal(out.moments.travel.state, "alternatives");
  assert.equal(out.perStudio.length, 0, "two open alternatives -> nothing drives the thread");
  assert.equal(Object.keys(out.nodeImpacts).length, 0);
});

test("aggregation groups by targetGoalId + metric + unit; sgd and months are never summed together", async () => {
  const branchesByPlan = [
    { plan: { domain: "loan", id: "p-loan" }, branches: [{ id: "b-loan", status: "active", data: { ...REALITY["p-loan"], extra_repayment: 300 } }] },
    { plan: { domain: "travel", id: "p-travel" }, branches: [{ id: "b-travel", status: "active", data: { ...REALITY["p-travel"], travellers: 4, nights: 16 } }] },
  ];
  const out = await collectStudioImpacts({ branchesByPlan, planStore: fakePlanStore(REALITY), threadContext: THREAD_CTX });

  // loan puts a `months` impact on emergency (monthsOfBufferForegone) and
  // an `sgd_per_month` impact on other goals - they must land in SEPARATE
  // aggregation groups.
  const units = new Set(out.aggregated.map((g) => g.unit));
  assert.ok(units.has("sgd_per_month"));
  for (const g of out.aggregated) {
    assert.ok(["sgd", "sgd_per_month", "months", "date_shift_months", "percentage", "count"].includes(g.unit), `group carries a typed unit: ${g.unit}`);
  }
  // no group ever mixes units
  const keys = out.aggregated.map((g) => `${g.targetGoalId}::${g.metric}::${g.unit}`);
  assert.equal(new Set(keys).size, keys.length, "one group per (goal, metric, unit)");
  // there is NO total impact score anywhere on the result
  assert.equal("totalImpactScore" in out, false);
  assert.equal("score" in out, false);
});

test("an impact with no typed unit is reported as invalid, not silently coerced", async () => {
  // craft an adapter-shaped result via a fake plan whose adapter emits a
  // unit-less goal: use the real travel adapter but strip units by
  // intercepting is not trivial here, so assert the guard directly.
  const { buildImpactMeasure, aggregateImpactMeasures } = await import("../lib/living-plan/impact-measure.js");
  const bad = buildImpactMeasure({ targetGoalId: "home", metric: "monthlyRoom", before: 0, possibleAfter: -100 });
  assert.equal(bad.valid, false);
  assert.equal(bad.invalidReason, "missing_or_unknown_unit");
  const { invalid } = aggregateImpactMeasures([bad]);
  assert.equal(invalid.length, 1);
});

test("enrichCrossGoalEdges attaches a unit-tagged magnitude + ghost/solid state to the impacted edge", () => {
  const edges = [
    { from: "home", to: "safety", direction: "flat", basis: "deposit saving vs emergency floor" },
    { from: "freedom", to: "future", direction: "flat", basis: "near-term capital vs long-term" },
  ];
  const nodeImpacts = {
    safety: [{ metric: "monthlyRoom", unit: "sgd_per_month", before: 0, possibleDelta: -180, possibleAfter: -180, confirmedAfter: null, state: "ghost", direction: "down", favourable: false }],
  };
  const enriched = enrichCrossGoalEdges(edges, nodeImpacts);
  const safetyEdge = enriched.find((e) => e.to === "safety");
  assert.equal(safetyEdge.direction, "down");
  assert.equal(safetyEdge.impactState, "ghost");
  assert.equal(safetyEdge.unit, "sgd_per_month");
  assert.equal(safetyEdge.magnitude, 180);
  assert.equal(enriched.find((e) => e.to === "future").impactState, "none");
});
