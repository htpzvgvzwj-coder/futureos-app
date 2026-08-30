// Calendar Orbit cross-goal projector (pure). Server-owned impactSet.
//
// A bigger / sooner trip raises the required monthly pace - monthly
// pressure on the near-term goals. A smaller / later trip lowers it -
// freed cashflow. Raising the contribution itself is also pressure now.
// Every affected goal is a GHOST (possibleAfter) until the customer
// explicitly allocates.

import { computeCalendarOrbit } from "./calendar-orbit-finance.js";
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

export function projectCalendarOrbitImpact({ branchPlan, realityPlan, context = {}, allocation = null, now }) {
  const rf = computeCalendarOrbit({ planData: realityPlan, context, now });
  const bf = computeCalendarOrbit({ planData: branchPlan, context, now });
  if (!rf.available || !bf.available) return null;

  // The monthly signal. If the customer moved their own contribution, THAT
  // is the real monthly movement. If they left the contribution alone but
  // reshaped the trip, the movement is the change in the pace they'd now
  // need to commit (unknown pace -> no signal, an honest gap).
  const reqBefore = n(rf.requiredMonthly);
  const reqAfter = n(bf.requiredMonthly);
  const contribBefore = n(rf.monthlyContribution.value) ?? 0;
  const contribAfter = n(bf.monthlyContribution.value) ?? 0;
  const contribDelta = contribAfter - contribBefore;
  const paceDelta = reqBefore != null && reqAfter != null ? reqAfter - reqBefore : 0;
  const effectiveDelta = contribDelta !== 0 ? contribDelta : paceDelta;
  const addedPressureMonthly = Math.max(0, effectiveDelta);
  const freedMonthly = Math.max(0, -effectiveDelta);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;
  const placed = allocation && (Number(allocation.goalMonthly) > 0 || Number(allocation.emergencyMonthly) > 0 || Number(allocation.flexibleMonthly) > 0);

  const breathingBefore = n(rf.currentBreathingRoomAfter.value);
  const breathingAfter = n(bf.currentBreathingRoomAfter.value);
  const signed = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;

  const affectedGoals = [
    {
      goalId: "emergency",
      metric: "currentBreathingRoom",
      before: breathingBefore,
      possibleAfter: breathingAfter != null ? breathingAfter : (breathingBefore != null ? breathingBefore + signed : null),
      confirmedAfter: placed ? (breathingAfter ?? (breathingBefore != null ? breathingBefore + signed : null)) : null,
      direction: dir(breathingBefore, breathingAfter != null ? breathingAfter : (breathingBefore != null ? breathingBefore + signed : null), true),
      confidence: "high",
      provenance: "system_estimate",
    },
    ...["home", "retirement", "wedding", "flexible"].map((goalId) => ({
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
      requiredMonthlyBefore: reqBefore,
      requiredMonthlyAfter: reqAfter,
      // The trip cost is a RANGE, never a point.
      tripCostRangeAfter: bf.tripCostRange,
      paceStateAfter: bf.paceState,
      fundedFractionAfter: bf.fundedFraction,
    },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (bf.planTotal !== rf.planTotal) parts.push(`trip cost ${Math.round(rf.planTotal)} -> ${Math.round(bf.planTotal)}`);
  if (bf.tripMonthInt !== rf.tripMonthInt) parts.push(`trip month ${rf.tripMonthInt ?? "?"} -> ${bf.tripMonthInt ?? "?"}`);
  if (Number(bf.monthlyContribution.value) !== Number(rf.monthlyContribution.value)) parts.push(`contribution ${Math.round(rf.monthlyContribution.value)} -> ${Math.round(bf.monthlyContribution.value)}/mo`);
  return parts.join(", ") || "trip plan changed";
}
