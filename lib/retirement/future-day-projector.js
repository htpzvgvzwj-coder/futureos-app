// Future-Day Loom cross-goal projector (pure). Server-owned impactSet.
//
// Pulling the Now/Future Seam toward the future raises the required
// contribution - monthly pressure on the near-term goals; pulling it
// toward now frees contribution. Ghost until the customer allocates.

import { computeFutureLoom } from "./future-day-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";
import { allocationLegs } from "../living-plan/allocation-legs.js";

function n(v) {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function projectFutureDayImpact({ branchPlan, realityPlan, context = {}, allocation = null }) {
  const rf = computeFutureLoom({ planData: realityPlan, context });
  const bf = computeFutureLoom({ planData: branchPlan, context });
  if (!rf.available || !bf.available) return null;

  const contribBefore = n(rf.currentContribution.value) ?? 0;
  const contribAfter = n(bf.currentContribution.value) ?? 0;
  const addedPressureMonthly = Math.max(0, contribAfter - contribBefore);
  const freedMonthly = Math.max(0, contribBefore - contribAfter);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;
  const legs = allocationLegs(allocation, "retirement");

  const breathingBefore = n(rf.currentBreathingRoomAfter.value);
  const breathingAfter = n(bf.currentBreathingRoomAfter.value);
  const signed = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;

  // confirmedAfter is derived per-leg by buildImpactSet from `legs`;
  // direction is derived there from the delta.
  const affectedGoals = [
    {
      goalId: "emergency",
      metric: "currentBreathingRoom",
      unit: "sgd_per_month",
      before: breathingBefore,
      possibleAfter: breathingAfter,
      confidence: "high",
      provenance: "system_estimate",
    },
    ...["investment", "home", "family", "insurance", "travel"].map((goalId) => ({
      goalId,
      metric: "monthlyRoom",
      unit: "sgd_per_month",
      before: 0,
      possibleAfter: signed,
      confidence: "medium",
      provenance: "system_estimate",
    })),
  ];

  return buildImpactSet({
    cause: describeCause(rf, bf),
    resourceDelta: {
      freedMonthly,
      addedPressureMonthly,
      openFutureBandBefore: rf.openFutureBand,
      openFutureBandAfter: bf.openFutureBand,
      // The gap is a RANGE, never a point.
      gapMonthlyRangeAfter: bf.gapMonthlyRange,
    },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
    legs,
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (Number(bf.currentContribution.value) !== Number(rf.currentContribution.value)) parts.push(`contribution ${Math.round(rf.currentContribution.value)} -> ${Math.round(bf.currentContribution.value)}/mo`);
  if (bf.futureAge !== rf.futureAge) parts.push(`future age ${rf.futureAge} -> ${bf.futureAge}`);
  if (JSON.stringify(bf.futureDay.contributions) !== JSON.stringify(rf.futureDay.contributions)) parts.push("Future Day changed");
  return parts.join(", ") || "retirement plan changed";
}
