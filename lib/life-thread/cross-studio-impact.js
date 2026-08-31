// Nine-Studio cross-goal integration (Living Thread - causal-spine round).
//
// Rules enforced here:
//   - A plan drives the Life Thread through EXACTLY ONE moment: its single
//     `active` branch (ghost) OR its `sealed` commitment (solid reality).
//     Open alternatives move nothing. Two active branches -> conflict,
//     nothing drives.
//   - Every effect is a typed ImpactMeasure with an explicit unit SUPPLIED
//     BY THE PROJECTOR. A measure with no unit is invalid - there is no
//     metric->unit guessing.
//   - Aggregation groups by targetGoalId + metric + unit; nothing is
//     summed across units; there is no "total impact score".

import { getFutureFieldAdapter } from "../future-field/adapters.js";
import { resolveCurrentMoment, impactSourceBranchId } from "../living-plan/current-moment.js";
import { buildImpactMeasure, aggregateImpactMeasures } from "../living-plan/impact-measure.js";

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
  return Number.isFinite(x) ? x : null;
}

export async function collectStudioImpacts({ branchesByPlan, planStore, threadContext = {}, commitmentsByPlanId = {} }) {
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
  const measures = [];
  const moments = {};
  const conflicts = [];

  for (const { plan, branches } of branchesByPlan) {
    const adapter = getFutureFieldAdapter(plan.domain);
    if (!adapter || typeof adapter.projectImpacts !== "function") continue;

    const sealed = commitmentsByPlanId[plan.id] ?? null;
    const moment = resolveCurrentMoment({ branches: branches ?? [], sealedCommitment: sealed });
    moments[plan.domain] = moment;

    if (moment.state === "conflict") {
      conflicts.push({ domain: plan.domain, planId: plan.id, activeBranchIds: moment.activeBranchIds ?? [] });
      continue; // a plan with >1 active branch drives NOTHING until it is resolved
    }
    const sourceBranchId = impactSourceBranchId(moment);
    if (moment.state === "reality" || moment.state === "alternatives" || !sourceBranchId) continue;

    const sourceBranch = (branches ?? []).find((b) => b.id === sourceBranchId);
    if (!sourceBranch) continue;

    let currentReality = null;
    try {
      const cur = await planStore.getCurrentPlanVersion(plan.id);
      currentReality = cur?.data ?? null;
    } catch {
      currentReality = null;
    }
    if (!currentReality) continue;

    // A SEALED plan is solid reality: project the sealed branch against
    // the reality that existed BEFORE the seal (reconstructed from the
    // branch's recorded delta.before), and mark every affected goal solid.
    // An ACTIVE branch is a ghost: project it against the current reality.
    const isSealed = moment.state === "sealedBranch";
    const priorReality = isSealed
      ? { ...currentReality, ...(sourceBranch.delta?.before && typeof sourceBranch.delta.before === "object" ? sourceBranch.delta.before : {}) }
      : currentReality;

    let impact = null;
    try {
      impact = adapter.projectImpacts(
        sourceBranch.data ?? currentReality,
        priorReality,
        projCtx,
        sourceBranch.data?.allocation ?? null,
      );
    } catch {
      impact = null;
    }
    if (!impact || !Array.isArray(impact.affectedGoals)) continue;

    const rd = impact.resourceDelta ?? {};
    perStudio.push({
      domain: plan.domain,
      planId: plan.id,
      branchId: sourceBranch.id,
      momentState: moment.state,
      state: isSealed ? "solid" : "ghost",
      cause: impact.cause ?? null,
      freedMonthly: Math.max(0, Math.round(n(rd.freedMonthly) ?? 0)),
      addedPressureMonthly: Math.max(0, Math.round(n(rd.addedPressureMonthly) ?? 0)),
      allocationRequired: Boolean(impact.allocationRequired),
    });

    for (const g of impact.affectedGoals) {
      if (g.direction === "flat") continue;
      // A sealed plan's effect is SOLID for every affected goal (the
      // commitment is confirmed reality); an active branch stays ghost
      // except where its own allocation leg was funded.
      const confirmedAfter = isSealed ? g.possibleAfter : g.confirmedAfter;
      const m = buildImpactMeasure({
        sourcePlanId: plan.id,
        sourceBranchId: sourceBranch.id,
        targetGoalId: g.goalId,
        metric: g.metric,
        unit: g.unit ?? null, // NO metric->unit guessing: an absent unit -> invalid
        before: g.before,
        possibleAfter: g.possibleAfter,
        confirmedAfter,
        confidence: g.confidence ?? "medium",
        provenance: g.provenance ?? "system_estimate",
      });
      measures.push(m);
    }
  }

  const { aggregated, invalid, groupCount } = aggregateImpactMeasures(measures);

  // Fold the aggregated groups onto life nodes - but keep the unit on
  // every entry so a consumer can never accidentally sum months + sgd.
  const nodeImpacts = {};
  for (const grp of aggregated) {
    const nodeId = GOAL_TO_NODE[grp.targetGoalId] ?? null;
    if (!nodeId) continue;
    (nodeImpacts[nodeId] = nodeImpacts[nodeId] ?? []).push({
      metric: grp.metric,
      unit: grp.unit,
      before: grp.before,
      possibleDelta: grp.possibleDelta,
      possibleAfter: grp.possibleAfter,
      confirmedDelta: grp.confirmedDelta,
      confirmedAfter: grp.confirmedAfter,
      state: grp.state,
      direction: grp.direction,
      favourable: grp.favourable,
    });
  }

  return {
    perStudio,
    moments,
    conflicts,
    measures: measures.filter((m) => m.valid !== false),
    invalidMeasures: invalid,
    aggregated,
    groupCount,
    nodeImpacts,
    studioCount: new Set(perStudio.map((s) => s.domain)).size,
    sealedStudioCount: perStudio.filter((s) => s.state === "solid").length,
    // resourceDelta totals - the ONLY figure that is summed, and only
    // because both keys are sgd_per_month by construction.
    monthlyResourceTotals: perStudio.reduce(
      (acc, s) => ({
        freedMonthly: acc.freedMonthly + s.freedMonthly,
        addedPressureMonthly: acc.addedPressureMonthly + s.addedPressureMonthly,
      }),
      { freedMonthly: 0, addedPressureMonthly: 0 },
    ),
  };
}

// Fold the per-node measure groups into the canonical crossGoalEdges. An
// edge whose `to` node has an impact takes the DOMINANT group's direction
// + magnitude (the group with the largest |possibleDelta|), and keeps its
// unit so nothing downstream can misread it.
export function enrichCrossGoalEdges(edges, nodeImpacts) {
  return edges.map((e) => {
    const groups = nodeImpacts[e.to];
    if (!Array.isArray(groups) || groups.length === 0) {
      return { ...e, magnitude: null, unit: null, impactState: "none" };
    }
    const rank = (g) => Math.abs(g.state === "solid" ? (g.confirmedDelta ?? 0) : g.possibleDelta);
    const dominant = [...groups].sort((a, b) => rank(b) - rank(a))[0];
    return {
      ...e,
      direction: dominant.direction,
      magnitude: rank(dominant),
      unit: dominant.unit,
      impactState: dominant.state, // ghost | solid
      groups, // the full per-metric breakdown, units intact
    };
  });
}
