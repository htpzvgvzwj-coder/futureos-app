// Nine-Studio cross-goal integration (Living Thread - causal-spine round).
//
// Rules enforced here:
//   - Only the ONE active branch per plan (or sealed reality) drives the
//     Life Thread. Open alternatives are ignored (comparison only).
//   - Every effect is a typed ImpactMeasure with an explicit unit.
//   - Aggregation groups by targetGoalId + metric + unit. sgd,
//     sgd_per_month, months, ... are never added together. No "total
//     impact score".

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

// metric -> unit, when an adapter's affectedGoal did not carry one.
const METRIC_UNIT = {
  currentBreathingRoom: "sgd_per_month",
  monthlyRoom: "sgd_per_month",
  liquidCapital: "sgd_per_month",
  emergencyBufferMonths: "months",
  knownExposure: "sgd",
  yearsToTarget: "months",
  monthsToTarget: "months",
  monthsToReady: "months",
  gapMonthly: "sgd_per_month",
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

  for (const { plan, branches } of branchesByPlan) {
    const adapter = getFutureFieldAdapter(plan.domain);
    if (!adapter || typeof adapter.projectImpacts !== "function") continue;

    // Resolve the ONE current moment for this plan.
    const sealed = commitmentsByPlanId[plan.id] ?? null;
    const moment = resolveCurrentMoment({ branches: branches ?? [], sealedCommitment: sealed });
    moments[plan.domain] = moment;
    const sourceBranchId = impactSourceBranchId(moment);
    if (!sourceBranchId) continue; // reality / alternatives -> nothing drives the thread

    const activeBranch = (branches ?? []).find((b) => b.id === sourceBranchId);
    if (!activeBranch) continue;

    let realityData = null;
    try {
      const cur = await planStore.getCurrentPlanVersion(plan.id);
      realityData = cur?.data ?? null;
    } catch {
      realityData = null;
    }
    if (!realityData) continue;

    let impact = null;
    try {
      impact = adapter.projectImpacts(activeBranch.data ?? realityData, realityData, projCtx, activeBranch.data?.allocation ?? null);
    } catch {
      impact = null;
    }
    if (!impact || !Array.isArray(impact.affectedGoals)) continue;

    const rd = impact.resourceDelta ?? {};
    perStudio.push({
      domain: plan.domain,
      planId: plan.id,
      branchId: activeBranch.id,
      momentState: moment.state,
      cause: impact.cause ?? null,
      // resourceDelta is monthly SGD by definition on both keys - kept
      // separate, never merged with anything else.
      freedMonthly: Math.max(0, Math.round(n(rd.freedMonthly) ?? 0)),
      addedPressureMonthly: Math.max(0, Math.round(n(rd.addedPressureMonthly) ?? 0)),
      allocationRequired: Boolean(impact.allocationRequired),
    });

    for (const g of impact.affectedGoals) {
      if (g.direction === "flat") continue;
      const unit = g.unit ?? METRIC_UNIT[g.metric] ?? null;
      const m = buildImpactMeasure({
        sourcePlanId: plan.id,
        sourceBranchId: activeBranch.id,
        targetGoalId: g.goalId,
        metric: g.metric ?? "monthlyRoom",
        unit,
        before: g.before,
        possibleAfter: g.possibleAfter,
        confirmedAfter: g.confirmedAfter,
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
      confirmedAfter: grp.confirmedAfter,
      state: grp.state,
      direction: grp.direction,
      favourable: grp.favourable,
    });
  }

  return {
    perStudio,
    moments,
    measures: measures.filter((m) => m.valid !== false),
    invalidMeasures: invalid,
    aggregated,
    groupCount,
    nodeImpacts,
    studioCount: new Set(perStudio.map((s) => s.domain)).size,
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
    const dominant = [...groups].sort((a, b) => Math.abs(b.possibleDelta) - Math.abs(a.possibleDelta))[0];
    return {
      ...e,
      direction: dominant.direction,
      magnitude: Math.abs(dominant.confirmedAfter != null ? dominant.confirmedAfter - (dominant.before ?? 0) : dominant.possibleDelta),
      unit: dominant.unit,
      impactState: dominant.state, // ghost | solid
      groups, // the full per-metric breakdown, units intact
    };
  });
}
