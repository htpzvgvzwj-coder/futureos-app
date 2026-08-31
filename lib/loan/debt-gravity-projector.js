// Debt Gravity cross-goal projector (pure). Server-owned impactSet.
//
// An extra repayment is monthly pressure NOW; the payment released at
// payoff is a Future Handoff Fragment - a GHOST until the debt actually
// clears, and never auto-routed (least of all to Home).

import { computeDebtGravity } from "./debt-gravity-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";
import { allocationLegs } from "../living-plan/allocation-legs.js";

function n(v) {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function projectDebtImpact({ branchPlan, realityPlan, debts = [], context = {}, allocation = null }) {
  const rf = computeDebtGravity({ debts, planData: realityPlan, context });
  const bf = computeDebtGravity({ debts, planData: branchPlan, context });
  if (!rf.available || !bf.available) return null;

  const extraBefore = n(rf.extraMonthly.value) ?? 0;
  const extraAfter = n(bf.extraMonthly.value) ?? 0;
  const addedPressureMonthly = Math.max(0, extraAfter - extraBefore);
  const freedMonthly = Math.max(0, extraBefore - extraAfter);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;

  const legs = allocationLegs(allocation, "home");

  const breathingBefore = n(rf.breathingRoom.value);
  const breathingAfter = n(bf.breathingRoom.value);
  const emergencyEffectBefore = n(rf.emergencyEffectMonths);
  const emergencyEffectAfter = n(bf.emergencyEffectMonths);
  const signed = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;

  const affectedGoals = [
    {
      // buffer-months foregone: a DIFFERENT unit (months), never summed
      // with the sgd_per_month effects below.
      goalId: "emergency",
      metric: "monthsOfBufferForegone",
      unit: "months",
      before: emergencyEffectBefore,
      possibleAfter: emergencyEffectAfter,
      confidence: "medium",
      provenance: "system_estimate",
    },
    {
      goalId: "loan",
      metric: "monthlyBreathingRoom",
      unit: "sgd_per_month",
      before: breathingBefore,
      possibleAfter: breathingAfter,
      confidence: "high",
      provenance: "system_estimate",
    },
    ...["home", "wedding", "investment", "retirement"].map((goalId) => ({
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
      // The payoff Future Handoff - a GHOST, reported but not part of the
      // freed/pressure the customer allocates now.
      futureHandoffAtPayoff: { whenMonth: bf.freedomDate, releasedMonthly: bf.releasedMonthlyAtFreedom.value, state: "ghost" },
      monthsSaved: (bf.bodies.find((b) => b.isTarget)?.monthsSaved ?? 0) - (rf.bodies.find((b) => b.isTarget)?.monthsSaved ?? 0),
    },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
    legs,
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (Number(bf.extraMonthly.value) !== Number(rf.extraMonthly.value)) parts.push(`extra ${Math.round(rf.extraMonthly.value)} -> ${Math.round(bf.extraMonthly.value)}/mo`);
  if (Number(bf.oneOff.value) !== Number(rf.oneOff.value)) parts.push(`one-off ${Math.round(bf.oneOff.value)}`);
  if (bf.targetDebtId !== rf.targetDebtId) parts.push(`target debt -> ${bf.targetDebtId}`);
  return parts.join(", ") || "repayment plan changed";
}
