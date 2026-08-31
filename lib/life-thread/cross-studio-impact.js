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
import { allocationLegs, legConfirmed, totalAllocated } from "../living-plan/allocation-legs.js";

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
  // One ledger row per released / pressuring resource, keyed by resourceId
  // so the same money is never counted twice (Σ placed <= total).
  const resourceLedger = {};

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
    const freedMonthly = Math.max(0, Math.round(n(rd.freedMonthly) ?? 0));
    const addedPressureMonthly = Math.max(0, Math.round(n(rd.addedPressureMonthly) ?? 0));

    // The resource this decision moves. `direct_pressure` = money going out
    // (a bigger plan); `released_resource` = money coming back (a smaller
    // plan). Each is ONE resource, counted ONCE, no matter how many goals
    // it touches.
    const mode =
      addedPressureMonthly > 0 ? "direct_pressure" : freedMonthly > 0 ? "released_resource" : "informational";
    const resourceId = `${plan.id}:${sourceBranch.id}:${mode}`;
    const legs = allocationLegs(sourceBranch.data?.allocation ?? null, "home");
    const placedMonthly = Math.min(mode === "direct_pressure" ? addedPressureMonthly : freedMonthly, Math.round(totalAllocated(legs)));

    perStudio.push({
      domain: plan.domain,
      planId: plan.id,
      branchId: sourceBranch.id,
      momentState: moment.state,
      state: isSealed ? "solid" : "ghost",
      cause: impact.cause ?? null,
      resourceId: mode === "informational" ? null : resourceId,
      freedMonthly,
      addedPressureMonthly,
      allocationRequired: Boolean(impact.allocationRequired),
    });

    if (mode !== "informational") {
      const totalMonthly = mode === "direct_pressure" ? addedPressureMonthly : freedMonthly;
      resourceLedger[resourceId] = {
        resourceId,
        planId: plan.id,
        branchId: sourceBranch.id,
        domain: plan.domain,
        kind: mode,
        // possible (nothing placed) -> placed (a destination chosen) ->
        // confirmed (sealed). direct_pressure is confirmed reality on Seal
        // even with nothing "placed" - the money genuinely left.
        state: isSealed ? "confirmed" : placedMonthly > 0 ? "placed" : "possible",
        totalMonthly: Math.round(totalMonthly),
        placedMonthly,
        unplacedMonthly: Math.max(0, Math.round(totalMonthly) - placedMonthly),
      };
    }

    for (const g of impact.affectedGoals) {
      if (g.direction === "flat") continue;
      const legFunded = legConfirmed(legs, g.goalId);
      // effectState per goal:
      //  - not sealed:            "placed" where this goal's own leg is
      //                            funded, else "possible". NEVER confirmed.
      //  - sealed direct_pressure: "confirmed" for every affected goal - the
      //                            money genuinely left, so every goal it
      //                            competes with really has less room. The
      //                            AMOUNT is still one resource (resourceId),
      //                            never re-summed across goals.
      //  - sealed released_resource: "confirmed" ONLY where this goal's leg
      //                            was funded; an unfunded goal stays
      //                            "possible" (the freed money did not go
      //                            there - it sits unplaced / flexible).
      let effectState;
      if (!isSealed) effectState = legFunded ? "placed" : "possible";
      else if (mode === "direct_pressure") effectState = "confirmed";
      else if (mode === "released_resource") effectState = legFunded ? "confirmed" : "possible";
      else effectState = "confirmed";

      const placedAfter = effectState === "possible" ? null : g.possibleAfter;
      const confirmedAfter = effectState === "confirmed" ? g.possibleAfter : null;

      const m = buildImpactMeasure({
        sourcePlanId: plan.id,
        sourceBranchId: sourceBranch.id,
        sourceMomentId: moment.commitmentId ?? moment.branchId ?? null,
        sourceType: isSealed ? "sealed_commitment" : "active_branch",
        resourceId: mode === "informational" ? null : resourceId,
        targetGoalId: g.goalId,
        allocationTargetGoalId: legFunded ? g.goalId : null,
        metric: g.metric,
        unit: g.unit ?? null, // NO metric->unit guessing: an absent unit -> invalid
        effectKind: mode,
        effectState,
        before: g.before,
        possibleAfter: g.possibleAfter,
        placedAfter,
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
      placedDelta: grp.placedDelta,
      placedAfter: grp.placedAfter,
      confirmedDelta: grp.confirmedDelta,
      confirmedAfter: grp.confirmedAfter,
      state: grp.state,
      placement: grp.placement,
      direction: grp.direction,
      favourable: grp.favourable,
    });
  }

  const ledgerRows = Object.values(resourceLedger);

  return {
    perStudio,
    moments,
    conflicts,
    measures: measures.filter((m) => m.valid !== false),
    invalidMeasures: invalid,
    aggregated,
    groupCount,
    nodeImpacts,
    resourceLedger,
    studioCount: new Set(perStudio.map((s) => s.domain)).size,
    sealedStudioCount: perStudio.filter((s) => s.state === "solid").length,
    // resourceDelta totals - summed ONCE PER resourceId (the same money is
    // never counted per-goal). Both keys are sgd_per_month by construction.
    monthlyResourceTotals: ledgerRows.reduce(
      (acc, r) => ({
        freedMonthly: acc.freedMonthly + (r.kind === "released_resource" ? r.totalMonthly : 0),
        addedPressureMonthly: acc.addedPressureMonthly + (r.kind === "direct_pressure" ? r.totalMonthly : 0),
        confirmedPlacedMonthly: acc.confirmedPlacedMonthly + (r.state === "confirmed" ? r.placedMonthly : 0),
        unplacedMonthly: acc.unplacedMonthly + (r.state === "confirmed" ? r.unplacedMonthly : 0),
      }),
      { freedMonthly: 0, addedPressureMonthly: 0, confirmedPlacedMonthly: 0, unplacedMonthly: 0 },
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
