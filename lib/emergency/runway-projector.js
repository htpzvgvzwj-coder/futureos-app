// Safety Runway cross-goal projector (pure). Server-owned impactSet: the
// client never guesses which goals a rebuild-contribution change moves.
//
// A higher monthly rebuild is monthly pressure that competes with every
// active goal; a lower one frees cashflow the customer then places. Nothing
// is auto-routed. A goal only moves as `confirmedAfter` once its leg is
// allocated.

import { computeSafetyRunway } from "./runway-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";

function n(v) {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function projectRunwayImpact({ branchData, realityData, context = {}, allocation = null }) {
  const rf = computeSafetyRunway({ planData: realityData, context });
  const bf = computeSafetyRunway({ planData: branchData, context });
  if (!rf.available || !bf.available) return null;

  const rebuildBefore = n(rf.monthlyRebuild.value) ?? 0;
  const rebuildAfter = n(bf.monthlyRebuild.value) ?? 0;
  const freedMonthly = Math.max(0, rebuildBefore - rebuildAfter);
  const addedPressureMonthly = Math.max(0, rebuildAfter - rebuildBefore);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;

  const placedLeg = allocation && (Number(allocation.goalMonthly) > 0 || Number(allocation.emergencyMonthly) > 0 || Number(allocation.flexibleMonthly) > 0);

  // The runway itself is the "self" outcome; the cross-goal effect is the
  // monthly pressure / relief on the customer's other active goals.
  const goalIds = Array.from(
    new Set([
      "home",
      "wedding",
      "investment",
      "retirement",
      "loan",
      ...(context.commitments ?? []).map((c) => c.domain),
    ]),
  ).filter((g) => g !== "emergency");

  const affectedGoals = goalIds.slice(0, 6).map((goalId) => {
    // A rebuild that costs more monthly reduces the room this goal has; a
    // freed rebuild gives room back. We express it as a monthly delta.
    const monthlyDelta = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;
    return {
      goalId,
      metric: "monthlyRoom",
      before: 0,
      possibleAfter: monthlyDelta,
      confirmedAfter: placedLeg ? monthlyDelta : null,
      direction: addedPressureMonthly > 0 ? "down" : freedMonthly > 0 ? "up" : "flat",
      confidence: "medium",
      provenance: "system_estimate",
    };
  });

  return buildImpactSet({
    cause: describeCause(rf, bf, realityData, branchData),
    resourceDelta: {
      freedMonthly,
      addedPressureMonthly,
      runwayBeforeMonths: rf.currentRunwayMonths,
      runwayAfterMonths: bf.currentRunwayMonths,
      protectedRunwayAfterMonths: bf.protectedRunwayMonths,
    },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
  });
}

function describeCause(rf, bf, reality, branch) {
  const parts = [];
  if (Number(branch.target_months) !== Number(reality.target_months)) parts.push(`target ${reality.target_months ?? 6} -> ${branch.target_months ?? 6} months`);
  if (Number(branch.monthly_contribution || 0) !== Number(reality.monthly_contribution || 0)) parts.push(`rebuild ${Math.round(rf.monthlyRebuild.value)} -> ${Math.round(bf.monthlyRebuild.value)}/mo`);
  if (JSON.stringify(branch.protected_commitments ?? []) !== JSON.stringify(reality.protected_commitments ?? [])) parts.push("protected commitments changed");
  return parts.join(", ") || "safety plan changed";
}
