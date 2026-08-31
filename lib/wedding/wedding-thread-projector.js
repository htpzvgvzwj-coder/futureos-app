// Wedding Studio cross-goal projector, aligned to the shared Studio
// Contract (Living Thread commit 10). Server-owned unified impactSet.
//
// A wedding branch that RELEASES the user's personal monthly need frees
// cashflow; one that raises it adds named monthly pressure. Every affected
// goal is a GHOST (possibleAfter) until the customer explicitly allocates
// the freed amount. Nothing is auto-routed to Home.

import { computeWeddingPlanFinance } from "./plan-finance.js";
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

export function projectWeddingThreadImpact({ branchPlan, realityPlan, context = {}, allocation = null }) {
  const rf = computeWeddingPlanFinance({ planData: realityPlan });
  const bf = computeWeddingPlanFinance({ planData: branchPlan });
  if (!rf.available || !bf.available) return null;

  // The user's OWN personal required monthly is the pressure signal.
  const reqBefore = n(rf.userRequiredMonthly) ?? n(rf.userMonthly) ?? 0;
  const reqAfter = n(bf.userRequiredMonthly) ?? n(bf.userMonthly) ?? 0;
  const addedPressureMonthly = Math.max(0, reqAfter - reqBefore);
  const freedMonthly = Math.max(0, reqBefore - reqAfter);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;
  const placed = allocation && (Number(allocation.goalMonthly) > 0 || Number(allocation.emergencyMonthly) > 0 || Number(allocation.flexibleMonthly) > 0);
  const signed = addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly;

  const income = n(context.monthlyIncome);
  const breathingBefore = income != null && income > 0
    ? Math.round(income - n(context.monthlyExpenses ?? 0) - n(context.committedExcludingWedding ?? context.committedExcludingDomain ?? 0) - reqBefore)
    : null;
  const breathingAfter = breathingBefore != null ? breathingBefore + signed : null;

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
      userRequiredMonthlyBefore: reqBefore,
      userRequiredMonthlyAfter: reqAfter,
      planTotalAfter: bf.planTotal,
      budgetGapAfter: bf.budgetGap,
    },
    affectedGoals,
    allocationRequired,
    assumptions: [
      { text: "Singapore reference-rate estimate, not a vendor quote", confidence: "low" },
      { text: "Partner's earmarked savings stay private; only their committed monthly is shared", confidence: "high" },
      { text: "Freed cashflow is never auto-routed - the customer places it", confidence: "high" },
    ],
  });
}

function describeCause(rf, bf) {
  const parts = [];
  if (bf.planTotal !== rf.planTotal) parts.push(`wedding cost ${Math.round(rf.planTotal)} -> ${Math.round(bf.planTotal)}`);
  if (Number(bf.userRequiredMonthly) !== Number(rf.userRequiredMonthly)) parts.push(`your monthly need ${Math.round(rf.userRequiredMonthly)} -> ${Math.round(bf.userRequiredMonthly)}/mo`);
  return parts.join(", ") || "wedding plan changed";
}
