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

// Shared fixture for the Part A three-state (possible / placed / confirmed) tests.
const WED_REALITY = {
  wedding_date: "2027-06", guest_count: 150, venue_tier: "mid_range", venue_type: "hotel",
  photography_tier: "mid", attire_tier: "mid", monthly_contribution: 800, partner_contribution: 400, current_savings: 6000,
};
const WED_CTX = { monthlyIncome: 8000, monthlyExpenses: 3800, committedMonthlyTotal: 900, emergencyBufferMonths: 6, availableMonthlyCashflow: 1500 };

function wedSealed({ data, allocation = null, revoked = false }) {
  const sealedData = { ...WED_REALITY, ...data, ...(allocation ? { allocation } : {}) };
  const branch = { id: "wed-sealed", status: "sealed", data: sealedData, delta: { before: { guest_count: 150 }, after: { guest_count: sealedData.guest_count } } };
  return {
    branchesByPlan: [{ plan: { domain: "wedding", id: "p-wed" }, branches: [branch] }],
    planStore: { getCurrentPlanVersion: async () => ({ data: sealedData }) },
    commitmentsByPlanId: revoked ? {} : { "p-wed": { id: "c-wed", plan_branch_id: "wed-sealed" } },
    threadContext: WED_CTX,
  };
}

test("Part A test 2: a SEALED release with NO allocation -> the freed resource is a confirmed FACT, but downstream goals stay ghost", async () => {
  const out = await collectStudioImpacts(wedSealed({ data: { guest_count: 90 } }));
  assert.equal(out.moments.wedding.state, "sealedBranch");
  assert.equal(out.perStudio[0].state, "solid");
  assert.equal(out.sealedStudioCount, 1);

  // the release itself is real, sealed, and entirely UNPLACED
  const ledger = Object.values(out.resourceLedger);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].kind, "released_resource");
  assert.equal(ledger[0].state, "confirmed");
  assert.ok(ledger[0].totalMonthly > 0);
  assert.equal(ledger[0].placedMonthly, 0, "nothing was routed");
  assert.equal(ledger[0].unplacedMonthly, ledger[0].totalMonthly, "the whole amount is flexible / unplaced");
  assert.equal(out.monthlyResourceTotals.confirmedPlacedMonthly, 0);

  // NOT every affected goal is Solid - the money did not go to Home / Retirement / Emergency
  const solidGroups = out.aggregated.filter((g) => g.state === "solid");
  assert.equal(solidGroups.length, 0, "an unallocated release confirms NO downstream goal");
  assert.ok(out.aggregated.length >= 2, "the possible (ghost) layer still shows what the money COULD do");
});

test("Part A test 1: a SEALED release allocated to Emergency -> only the funded leg is Solid; Home / Retirement are not", async () => {
  const ghost = await collectStudioImpacts(wedSealed({ data: { guest_count: 90 }, revoked: true, allocation: null }));
  void ghost;
  const freed = Object.values((await collectStudioImpacts(wedSealed({ data: { guest_count: 90 } }))).resourceLedger)[0].totalMonthly;

  const out = await collectStudioImpacts(wedSealed({ data: { guest_count: 90 }, allocation: { emergency: freed } }));
  const ledger = Object.values(out.resourceLedger)[0];
  assert.equal(ledger.state, "confirmed");
  assert.equal(ledger.placedMonthly, freed, "the whole freed amount is placed on Emergency");
  assert.equal(ledger.unplacedMonthly, 0);
  assert.equal(out.monthlyResourceTotals.confirmedPlacedMonthly, freed);

  const emergency = out.aggregated.find((g) => g.targetGoalId === "emergency");
  assert.ok(emergency && emergency.state === "solid", "the funded Emergency leg is Solid");
  for (const g of out.aggregated.filter((g) => g.targetGoalId !== "emergency")) {
    assert.equal(g.state, "ghost", `${g.targetGoalId} was not funded -> stays a ghost`);
  }
  // Σ confirmed placed <= freed (resource conservation)
  assert.ok(out.monthlyResourceTotals.confirmedPlacedMonthly <= ledger.totalMonthly);
});

test("Part A test 3: a SEALED bigger wedding adds pressure counted ONCE, not once per affected goal", async () => {
  const out = await collectStudioImpacts(wedSealed({ data: { guest_count: 260, venue_tier: "premium" } }));
  const ledger = Object.values(out.resourceLedger)[0];
  assert.equal(ledger.kind, "direct_pressure");
  assert.equal(ledger.state, "confirmed");
  const perStudioPressure = out.perStudio[0].addedPressureMonthly;
  assert.ok(perStudioPressure > 0);
  // the ledger total equals ONE studio's pressure - it is NOT multiplied by
  // the number of goals the pressure competes with.
  assert.equal(ledger.totalMonthly, perStudioPressure);
  assert.equal(out.monthlyResourceTotals.addedPressureMonthly, perStudioPressure, "counted once");
  // sealed direct pressure IS confirmed reality on every goal it competes with
  const solidGroups = out.aggregated.filter((g) => g.state === "solid");
  assert.ok(solidGroups.length >= 2, "the money genuinely left -> every competing goal really has less room");
  // ...but each goal is its OWN (goal,metric,unit) group - the amounts are never summed together
  const keys = out.aggregated.map((g) => `${g.targetGoalId}::${g.metric}::${g.unit}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("Part A test 4: revoking a SEALED release removes the Solid impact and restores prior reality", async () => {
  const freed = Object.values((await collectStudioImpacts(wedSealed({ data: { guest_count: 90 } }))).resourceLedger)[0].totalMonthly;

  const sealed = await collectStudioImpacts(wedSealed({ data: { guest_count: 90 }, allocation: { emergency: freed } }));
  assert.ok(sealed.aggregated.some((g) => g.state === "solid"));

  const revoked = await collectStudioImpacts(wedSealed({ data: { guest_count: 90 }, allocation: { emergency: freed }, revoked: true }));
  assert.notEqual(revoked.moments.wedding.state, "sealedBranch");
  assert.equal(revoked.perStudio.length, 0, "no active branch, no sealed commitment -> nothing drives");
  assert.equal(revoked.sealedStudioCount, 0);
  assert.equal(Object.keys(revoked.resourceLedger).length, 0);
  assert.equal(revoked.aggregated.filter((g) => g.state === "solid").length, 0);
});

test("NO metric->unit guessing: an affected goal with no unit is INVALID, not coerced", async () => {
  // A fake adapter whose projector forgets the unit on one goal.
  const fakeAdapters = await import("../lib/future-field/adapters.js");
  const orig = fakeAdapters.getFutureFieldAdapter;
  // patch is not possible on an ESM export; instead assert the measure
  // path directly via a hand-built impact through collectStudioImpacts is
  // out of reach, so assert buildImpactMeasure's contract (the single
  // source of truth collectStudioImpacts now relies on).
  const { buildImpactMeasure } = await import("../lib/living-plan/impact-measure.js");
  const noUnit = buildImpactMeasure({ targetGoalId: "future", metric: "yearsToTarget", before: 12, possibleAfter: 9 });
  assert.equal(noUnit.valid, false, "yearsToTarget with no unit is invalid, never silently 'months'");
  assert.equal(noUnit.invalidReason, "missing_or_unknown_unit");
  void orig;
});

test("two active branches on one plan -> conflict -> that plan drives NOTHING", async () => {
  const branchesByPlan = [
    {
      plan: { domain: "travel", id: "p-travel" },
      branches: [
        { id: "x", status: "active", data: { ...REALITY["p-travel"], nights: 4 } },
        { id: "y", status: "active", data: { ...REALITY["p-travel"], nights: 18 } },
      ],
    },
  ];
  const out = await collectStudioImpacts({ branchesByPlan, planStore: fakePlanStore(REALITY), threadContext: THREAD_CTX });
  assert.equal(out.moments.travel.state, "conflict");
  assert.equal(out.perStudio.length, 0);
  assert.equal(out.conflicts.length, 1);
  assert.deepEqual(out.conflicts[0].activeBranchIds.sort(), ["x", "y"]);
});
