// Home Horizon cross-goal projector (pure). Given a branch vs reality, it
// returns the SERVER-owned impactSet the Living Thread and the scene draw
// from - the client never guesses an impact direction.
//
// Possible impact = possibleAfter (ghost). It only becomes confirmedAfter
// once the customer has placed the freed / added resource (allocation).

import { computeHomeHorizon } from "./horizon-finance.js";
import { buildImpactSet } from "../living-plan/studio-contract.js";

function n(v) {
  if (v == null) return null; // Number(null) === 0 - guard it
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function dir(before, after, betterIsHigher = true) {
  if (before == null || after == null) return "flat";
  if (Math.abs(after - before) < 0.05) return "flat";
  const rose = after > before;
  return (rose && betterIsHigher) || (!rose && !betterIsHigher) ? "up" : "down";
}

export function projectHomeImpact({ branchData, realityData, context = {}, allocation = null }) {
  const rf = computeHomeHorizon({ planData: realityData, context });
  const bf = computeHomeHorizon({ planData: branchData, context });
  if (!rf.available || !bf.available) return null;

  // The monthly cost that actually competes with other goals is the pace
  // needed to still hit the target month (deposit build), plus - once the
  // home is bought - the repayment. We compare "required pace to keep the
  // same target month" before vs after, not the stated pace.
  const rMonths = n(rf.readiness.monthsToReady);
  const targetIdx = monthsToTargetIdx(realityData.target_complete_month, branchData.target_complete_month, rMonths);
  const requiredPace = (h) => {
    const short = n(h.readiness.shortfall.value) ?? 0;
    if (short <= 0) return 0;
    if (targetIdx && targetIdx > 0) return Math.round(short / targetIdx);
    return n(h.readiness.monthlySavingsPace.value) ?? 0;
  };
  const paceBefore = requiredPace(rf);
  const paceAfter = requiredPace(bf);
  const repayBefore = n(rf.loan.monthlyRepayment.value) ?? 0;
  const repayAfter = n(bf.loan.monthlyRepayment.value) ?? 0;

  const freedMonthly = Math.max(0, paceBefore - paceAfter);
  const addedPressureMonthly = Math.max(0, paceAfter - paceBefore);
  // Future monthly pressure once the home is owned (informational - not the
  // freed/pressure the customer allocates now).
  const futureRepaymentDelta = Math.round(repayAfter - repayBefore);
  const upfrontDelta = (n(bf.upfrontStack.upfrontCashRequired.value) ?? 0) - (n(rf.upfrontStack.upfrontCashRequired.value) ?? 0);
  const allocationRequired = freedMonthly > 0 || addedPressureMonthly > 0;

  // Only legs the customer actually placed become "confirmed". With no
  // allocation, every other goal stays a ghost.
  const placed = allocation && (Number(allocation.goalMonthly) > 0 || Number(allocation.emergencyMonthly) > 0 || Number(allocation.flexibleMonthly) > 0);

  const emergencyBefore = n(context.emergencyBufferMonths);
  const emergencyPossibleAfter = n(bf.afterlife.postPurchaseEmergencyMonths);
  const breathingBefore = n(rf.afterlife.monthlyBreathingRoom.value);
  const breathingAfter = n(bf.afterlife.monthlyBreathingRoom.value);
  const cashBefore = n(rf.afterlife.cashAfterPurchase.value);
  const cashAfter = n(bf.afterlife.cashAfterPurchase.value);

  const weddingActive = Boolean(context.weddingActive);
  const retirementActive = Boolean(context.retirementActive);

  // Emergency: use the post-purchase buffer in months when expenses are
  // known; otherwise fall back to the liquid-cash-after-purchase signal so
  // the direction is still honest (less cash -> less emergency capacity).
  const emergencyKnownInMonths = emergencyBefore != null && emergencyPossibleAfter != null;
  const affectedGoals = [
    emergencyKnownInMonths
      ? {
          goalId: "emergency",
          metric: "postPurchaseBufferMonths",
          before: emergencyBefore,
          possibleAfter: emergencyPossibleAfter,
          confirmedAfter: placed ? emergencyPossibleAfter : null,
          direction: dir(emergencyBefore, emergencyPossibleAfter, true),
          confidence: "high",
          provenance: "bank_confirmed",
        }
      : {
          goalId: "emergency",
          metric: "liquidCashAfterPurchase",
          before: cashBefore,
          possibleAfter: cashAfter,
          confirmedAfter: placed ? cashAfter : null,
          direction: dir(cashBefore, cashAfter, true),
          confidence: "medium",
          provenance: "system_estimate",
        },
    {
      goalId: "loan",
      metric: "monthlyBreathingRoom",
      before: breathingBefore,
      possibleAfter: breathingAfter,
      confirmedAfter: placed ? breathingAfter : null,
      direction: dir(breathingBefore, breathingAfter, true),
      confidence: "high",
      provenance: "system_estimate",
    },
    {
      goalId: "investment",
      metric: "liquidCashAfterPurchase",
      before: cashBefore,
      possibleAfter: cashAfter,
      confirmedAfter: placed ? cashAfter : null,
      direction: dir(cashBefore, cashAfter, true),
      confidence: "medium",
      provenance: "system_estimate",
    },
    {
      goalId: "wedding",
      metric: "readyMonthShift",
      before: 0,
      possibleAfter: weddingActive ? (freedMonthly > 0 ? -1 : addedPressureMonthly > 0 ? 1 : 0) : 0,
      confirmedAfter: placed && weddingActive ? (freedMonthly > 0 ? -1 : addedPressureMonthly > 0 ? 1 : 0) : null,
      direction: weddingActive ? (freedMonthly > 0 ? "up" : addedPressureMonthly > 0 ? "down" : "flat") : "flat",
      confidence: weddingActive ? "medium" : "low",
      provenance: weddingActive ? "system_estimate" : "unknown",
    },
    {
      goalId: "retirement",
      metric: "monthlyContributionCapacity",
      before: 0,
      possibleAfter: retirementActive ? (addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly) : 0,
      confirmedAfter: placed && retirementActive ? (addedPressureMonthly > 0 ? -addedPressureMonthly : freedMonthly) : null,
      direction: retirementActive ? (addedPressureMonthly > 0 ? "down" : freedMonthly > 0 ? "up" : "flat") : "flat",
      confidence: retirementActive ? "medium" : "low",
      provenance: retirementActive ? "system_estimate" : "unknown",
    },
  ];

  return buildImpactSet({
    cause: describeCause(realityData, branchData),
    resourceDelta: { freedMonthly, addedPressureMonthly, upfrontDelta: Math.round(upfrontDelta), futureRepaymentDelta },
    affectedGoals,
    allocationRequired,
    assumptions: bf.assumptions,
  });
}

function monthsToTargetIdx(realityMonth, branchMonth, fallbackMonths) {
  const m = /^\d{4}-\d{2}/.test(String(branchMonth ?? "")) ? branchMonth : realityMonth;
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return fallbackMonths ?? null;
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  const now = new Date();
  return y * 12 + (mo - 1) - (now.getUTCFullYear() * 12 + now.getUTCMonth());
}

function describeCause(reality, branch) {
  const parts = [];
  if (Number(branch.estimated_price) !== Number(reality.estimated_price)) {
    parts.push(`price ${Math.round(Number(reality.estimated_price) || 0)} -> ${Math.round(Number(branch.estimated_price) || 0)}`);
  }
  if (branch.target_complete_month !== reality.target_complete_month) {
    parts.push(`month ${reality.target_complete_month ?? "?"} -> ${branch.target_complete_month ?? "?"}`);
  }
  if (Number(branch.partner_contribution || 0) !== Number(reality.partner_contribution || 0)) parts.push("partner contribution changed");
  if (Number(branch.rate_assumption || 0) !== Number(reality.rate_assumption || 0)) parts.push("rate assumption changed");
  return parts.join(", ") || "home plan changed";
}
