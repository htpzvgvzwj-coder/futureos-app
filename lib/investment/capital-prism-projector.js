// Capital Prism cross-goal projector (pure). Server-owned impactSet.
//
// Moving capital into the LOCKED investing bands (retirement + long-term)
// is monthly pressure on the near-term, liquid jobs; moving it back out
// frees liquid capital. Every affected goal is a GHOST (possibleAfter)
// until the customer explicitly allocates.

import { computeCapitalPrism } from "./capital-prism-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";
import { allocationLegs } from "../living-plan/allocation-legs.js";

function n(v) {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
export function projectCapitalPrismImpact({ branchPlan, realityPlan, context = {}, allocation = null }) {
  const rf = computeCapitalPrism({ planData: realityPlan, context });
  const bf = computeCapitalPrism({ planData: branchPlan, context });
  if (!rf.available || !bf.available) return null;

  const investBefore = n(rf.investingCommitment.value) ?? 0;
  const investAfter = n(bf.investingCommitment.value) ?? 0;
  const addedPressureMonthly = Math.max(0, investAfter - investBefore);
  const freedMonthly = Math.max(0, investBefore - investAfter);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;
  const legs = allocationLegs(allocation, "home");
  const signed = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;

  const liquidBefore = n(rf.liquidKept.value);
  const liquidAfter = n(bf.liquidKept.value);

  const affectedGoals = [
    {
      goalId: "emergency",
      metric: "liquidCapital",
      unit: "sgd_per_month",
      before: liquidBefore,
      possibleAfter: liquidAfter,
      confidence: "high",
      provenance: "system_estimate",
    },
    ...["home", "wedding", "retirement", "flexible"].map((goalId) => ({
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
      yearsToTargetBefore: rf.yearsToTarget,
      yearsToTargetAfter: bf.yearsToTarget,
      liquidKeptAfter: liquidAfter,
      openHorizonBandBefore: rf.openHorizonBand,
      openHorizonBandAfter: bf.openHorizonBand,
    },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
    legs,
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (Number(bf.investingCommitment.value) !== Number(rf.investingCommitment.value)) {
    parts.push(`investing ${Math.round(rf.investingCommitment.value)} -> ${Math.round(bf.investingCommitment.value)}/mo`);
  }
  if (bf.gateYears !== rf.gateYears) parts.push(`liquidity gate ${rf.gateYears}y -> ${bf.gateYears}y`);
  return parts.join(", ") || "capital split changed";
}
