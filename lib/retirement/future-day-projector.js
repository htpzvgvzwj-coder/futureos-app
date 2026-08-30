// Future-Day Loom cross-goal projector (pure). Server-owned impactSet.
//
// Pulling the Now/Future Seam toward the future raises the required
// contribution - monthly pressure on the near-term goals; pulling it
// toward now frees contribution. Ghost until the customer allocates.

import { computeFutureLoom } from "./future-day-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";

function n(v) {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function dir(before, after, betterIsHigher = true) {
  if (before == null || after == null) return "flat";
  if (Math.abs(after - before) < 0.05) return "flat";
  const rose = after > before;
  return (rose && betterIsHigher) || (!rose && !betterIsHigher) ? "up" : "down";
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
  const placed = allocation && (Number(allocation.goalMonthly) > 0 || Number(allocation.emergencyMonthly) > 0 || Number(allocation.flexibleMonthly) > 0);

  const breathingBefore = n(rf.currentBreathingRoomAfter.value);
  const breathingAfter = n(bf.currentBreathingRoomAfter.value);

  const affectedGoals = [
    {
      goalId: "emergency",
      metric: "currentBreathingRoom",
      before: breathingBefore,
      possibleAfter: breathingAfter,
      confirmedAfter: placed ? breathingAfter : null,
      direction: dir(breathingBefore, breathingAfter, true),
      confidence: "high",
      provenance: "system_estimate",
    },
    ...["investment", "home", "family", "insurance", "travel"].map((goalId) => ({
      goalId,
      metric: "monthlyRoom",
      before: 0,
      possibleAfter: addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly,
      confirmedAfter: placed ? (addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly) : null,
      direction: addedPressureMonthly > 0 ? "down" : freedMonthly > 0 ? "up" : "flat",
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
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (Number(bf.currentContribution.value) !== Number(rf.currentContribution.value)) parts.push(`contribution ${Math.round(rf.currentContribution.value)} -> ${Math.round(bf.currentContribution.value)}/mo`);
  if (bf.futureAge !== rf.futureAge) parts.push(`future age ${rf.futureAge} -> ${bf.futureAge}`);
  if (JSON.stringify(bf.futureDay.contributions) !== JSON.stringify(rf.futureDay.contributions)) parts.push("Future Day changed");
  return parts.join(", ") || "retirement plan changed";
}
