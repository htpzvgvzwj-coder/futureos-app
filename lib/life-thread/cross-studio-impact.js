// Nine-Studio cross-goal integration (Living Thread commit 11).
//
// Every Studio adapter now emits the SAME unified impactSet
// (resourceDelta + affectedGoals, ghost vs solid). This module runs each
// active draft branch through its adapter and folds the results into the
// canonical Life Thread's cross-goal edges - so an edge on Today / Life /
// Explore / Guardian carries a REAL freed/pressure magnitude and a real
// ghost/solid state, not just "a draft exists".

import { getFutureFieldAdapter } from "../future-field/adapters.js";

// affected-goal id -> canonical life-node id
const GOAL_TO_NODE = {
  emergency: "safety",
  safety: "safety",
  home: "home",
  retirement: "future",
  future: "future",
  wedding: "relationships",
  family: "relationships",
  relationships: "relationships",
  investment: "freedom",
  flexible: "freedom",
  freedom: "freedom",
  income: "income",
};

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function collectStudioImpacts({ branchesByPlan, planStore, threadContext = {} }) {
  const projCtx = {
    monthlyIncome: threadContext.monthlyIncome ?? null,
    monthlyExpenses: threadContext.monthlyExpenses ?? null,
    committedExcludingDomain: threadContext.committedMonthlyTotal ?? 0,
    committedMonthlyTotal: threadContext.committedMonthlyTotal ?? 0,
    otherGoalsMonthlyOutflow: threadContext.committedMonthlyTotal ?? 0,
    emergencyBufferMonths: threadContext.emergencyBufferMonths ?? null,
    availableMonthlyCashflow: threadContext.availableMonthlyCashflow ?? null,
  };

  const perStudio = [];
  const nodeAgg = new Map(); // nodeId -> { ghost, solid, sources:Set }

  for (const { plan, branches } of branchesByPlan) {
    const adapter = getFutureFieldAdapter(plan.domain);
    if (!adapter || typeof adapter.projectImpacts !== "function") continue;
    const openBranches = (branches ?? []).filter((b) => b.status === "open");
    if (openBranches.length === 0) continue;

    let realityData = null;
    try {
      const cur = await planStore.getCurrentPlanVersion(plan.id);
      realityData = cur?.data ?? null;
    } catch {
      realityData = null;
    }
    if (!realityData) continue;

    for (const b of openBranches) {
      let impact = null;
      try {
        impact = adapter.projectImpacts(b.data ?? realityData, realityData, projCtx, b.data?.allocation ?? null);
      } catch {
        impact = null;
      }
      if (!impact || !Array.isArray(impact.affectedGoals)) continue;

      const rd = impact.resourceDelta ?? {};
      perStudio.push({
        domain: plan.domain,
        branchId: b.id,
        cause: impact.cause ?? null,
        freedMonthly: n(rd.freedMonthly),
        addedPressureMonthly: n(rd.addedPressureMonthly),
        allocationRequired: Boolean(impact.allocationRequired),
      });

      for (const g of impact.affectedGoals) {
        if (g.direction === "flat") continue;
        const nodeId = GOAL_TO_NODE[g.goalId] ?? null;
        if (!nodeId) continue;
        const entry = nodeAgg.get(nodeId) ?? { ghost: 0, solid: 0, sources: new Set() };
        const ghost = g.confirmedAfter != null ? 0 : n(g.possibleAfter);
        const solid = g.confirmedAfter != null ? n(g.confirmedAfter) : 0;
        entry.ghost += ghost;
        entry.solid += solid;
        entry.sources.add(plan.domain);
        nodeAgg.set(nodeId, entry);
      }
    }
  }

  const nodeImpacts = {};
  for (const [nodeId, e] of nodeAgg) {
    const net = e.solid !== 0 ? e.solid : e.ghost;
    nodeImpacts[nodeId] = {
      ghostMonthly: Math.round(e.ghost),
      solidMonthly: Math.round(e.solid),
      state: e.solid !== 0 ? "solid" : "ghost",
      direction: net > 0.5 ? "up" : net < -0.5 ? "down" : "flat",
      sources: [...e.sources],
    };
  }

  const totals = perStudio.reduce(
    (acc, s) => ({
      freedMonthly: acc.freedMonthly + s.freedMonthly,
      addedPressureMonthly: acc.addedPressureMonthly + s.addedPressureMonthly,
    }),
    { freedMonthly: 0, addedPressureMonthly: 0 },
  );

  return {
    perStudio,
    nodeImpacts,
    totals: { freedMonthly: Math.round(totals.freedMonthly), addedPressureMonthly: Math.round(totals.addedPressureMonthly) },
    studioCount: new Set(perStudio.map((s) => s.domain)).size,
  };
}

// Fold the node impacts into the canonical crossGoalEdges: an edge whose
// `to` node has a real studio impact gets a magnitude + ghost/solid state.
export function enrichCrossGoalEdges(edges, nodeImpacts) {
  return edges.map((e) => {
    const ni = nodeImpacts[e.to];
    if (!ni || ni.direction === "flat") return { ...e, magnitudeMonthly: 0, impactState: "none" };
    return {
      ...e,
      direction: ni.direction,
      magnitudeMonthly: Math.abs(ni.solidMonthly || ni.ghostMonthly),
      impactState: ni.state, // ghost | solid
      impactSources: ni.sources,
    };
  });
}
