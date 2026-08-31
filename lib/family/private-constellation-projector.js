// Private Constellation cross-goal projector (pure). Server-owned impactSet.
//
// Raising the shared contribution raises the VIEWER'S share - monthly
// pressure on the viewer's near-term goals. Lowering it frees the
// viewer's cashflow. The other participant's numbers never enter this
// computation. Every affected goal is a GHOST until allocated.

import { computePrivateConstellation } from "./private-constellation-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";

function n(v) {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function dir(before, after, betterIsHigher = true) {
  if (before == null || after == null) return "flat";
  if (Math.abs(after - before) < 0.5) return "flat";
  const rose = after > before;
  return (rose && betterIsHigher) || (!rose && !betterIsHigher) ? "up" : "down";
}

export function projectPrivateConstellationImpact({ branchPlan, realityPlan, context = {}, allocation = null, viewerKey = null }) {
  const rf = computePrivateConstellation({ planData: realityPlan, viewerKey, context });
  const bf = computePrivateConstellation({ planData: branchPlan, viewerKey, context });
  if (!rf.available || !bf.available) return null;

  const shareBefore = n(rf.viewerShare.value) ?? 0;
  const shareAfter = n(bf.viewerShare.value) ?? 0;
  const addedPressureMonthly = Math.max(0, shareAfter - shareBefore);
  const freedMonthly = Math.max(0, shareBefore - shareAfter);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;
  const placed = allocation && (Number(allocation.goalMonthly) > 0 || Number(allocation.emergencyMonthly) > 0 || Number(allocation.flexibleMonthly) > 0);
  const signed = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;

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
    ...["home", "retirement", "flexible"].map((goalId) => ({
      goalId,
      metric: "monthlyRoom",
      before: 0,
      possibleAfter: signed,
      confirmedAfter: placed ? signed : null,
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
      viewerShareAfter: shareAfter,
      jointBandAfter: bf.jointBand,
      // The other participant's share is NOT part of the viewer's impactSet.
    },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (Number(bf.viewerShare.value) !== Number(rf.viewerShare.value)) parts.push(`your share ${rf.viewerShare.value} -> ${bf.viewerShare.value}/mo`);
  if (bf.sharedMonthlyContribution !== rf.sharedMonthlyContribution) parts.push(`shared contribution ${rf.sharedMonthlyContribution} -> ${bf.sharedMonthlyContribution}/mo`);
  return parts.join(", ") || "shared plan changed";
}
