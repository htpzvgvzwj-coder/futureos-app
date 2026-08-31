// Living Envelope cross-goal projector (pure). Server-owned impactSet.
//
// Stretching the membrane to close an exposure costs monthly premium -
// pressure on the near-term goals. Trimming cover the customer no longer
// needs frees premium. Every affected goal is a GHOST until allocated.

import { computeLivingEnvelope } from "./living-envelope-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";
import { allocationLegs } from "../living-plan/allocation-legs.js";

function n(v) {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
export function projectLivingEnvelopeImpact({ branchPlan, realityPlan, context = {}, allocation = null }) {
  const rf = computeLivingEnvelope({ planData: realityPlan, context });
  const bf = computeLivingEnvelope({ planData: branchPlan, context });
  if (!rf.available || !bf.available) return null;

  const premBefore = n(rf.premiumAfter.value) ?? 0;
  const premAfter = n(bf.premiumAfter.value) ?? 0;
  const addedPressureMonthly = Math.max(0, Math.round(premAfter - premBefore));
  const freedMonthly = Math.max(0, Math.round(premBefore - premAfter));
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;
  const legs = allocationLegs(allocation, "home");
  const signed = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;

  const breathingBefore = n(rf.currentBreathingRoomAfter.value);
  const breathingAfter = n(bf.currentBreathingRoomAfter.value);

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
    ...["home", "family", "retirement", "flexible"].map((goalId) => ({
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
      knownExposureBefore: rf.knownExposure,
      knownExposureAfter: bf.knownExposure,
      premiumAfter: premAfter,
    },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
    legs,
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (Number(bf.premiumAfter.value) !== Number(rf.premiumAfter.value)) parts.push(`premium ${rf.premiumAfter.value} -> ${bf.premiumAfter.value}/mo`);
  if (bf.knownExposure !== rf.knownExposure) parts.push(`known exposure ${rf.knownExposure} -> ${bf.knownExposure}`);
  return parts.join(", ") || "protection membrane changed";
}
