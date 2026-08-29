// Change Ledger producers for the Home domain (pure - no DB/AI).
//
// These turn the real numbers a Home route already computed into a
// validated ledger event draft. The route stays thin; the event shape lives
// here so it's testable and consistent. Numbers in - numbers out; nothing
// invented.

import { ACTION_TYPES, buildImpact, makeDedupeKey } from "../events.js";

// "Adopt this pace" -> a real scheduled commitment. status is "scheduled",
// NOT "active": FutureOS has no real bank-transfer execution, so the
// monthly move is arranged, not yet performed (the brief's truthfulness
// ladder - projected < simulated < scheduled < actual).
export function buildHomeCommitmentCreatedEvent({
  profileKey,
  commitmentId,
  priorMonthlyContribution,
  newMonthlyContribution,
  effectiveMonth,
  readyMonthBefore,
  readyMonthAfter,
  monthsDelta, // + = later, - = earlier; null if not computable
  reasonCode, // 'expense_increase' | 'behind_pace'
  reasonParams = {},
  emergencyFloorMonths,
}) {
  const impactSet = [
    buildImpact({
      goalId: "home",
      metric: "monthlyContribution",
      before: priorMonthlyContribution,
      after: newMonthlyContribution,
      unit: "sgd_per_month",
    }),
  ];
  if (monthsDelta != null) {
    impactSet.push(
      buildImpact({
        goalId: "home",
        metric: "targetDate",
        before: 0,
        after: monthsDelta,
        unit: "months",
        direction: monthsDelta === 0 ? "flat" : monthsDelta > 0 ? "down" : "up",
      }),
    );
  }

  return {
    profileKey,
    actor: "user",
    sourceFeature: "home",
    actionType: ACTION_TYPES.COMMITMENT_CREATED,
    status: "scheduled",
    commitmentId,
    relatedGoalIds: ["home"],
    visibility: "private",
    cause: {
      trigger: "home_goal_shift_moment",
      reasonCode,
      reasonParams,
      emergencyFloorMonths,
    },
    beforeSnapshot: {
      monthlyContribution: priorMonthlyContribution,
      readyMonth: readyMonthBefore ?? null,
    },
    afterSnapshot: {
      monthlyContribution: newMonthlyContribution,
      effectiveMonth,
      readyMonth: readyMonthAfter ?? null,
    },
    impactSet,
    evidenceRefs: [{ kind: "savings_checkins", ref: "home", sourceUpdatedAt: new Date().toISOString() }],
    confidence: "high",
    messageKey: "changeLedger.event.commitment_created.headline",
    messageParams: { amount: newMonthlyContribution, month: effectiveMonth },
    dedupeKey: makeDedupeKey(["home", "commitment_created", commitmentId]),
  };
}

// Revoke -> a NEW event that points at the create event (supersedes). The
// original is never deleted; it's shown struck-through / "no longer in
// effect". after_snapshot carries the restored prior amount.
export function buildHomeCommitmentRevokedEvent({
  profileKey,
  commitmentId,
  supersedesEventId,
  restoredMonthlyContribution,
  adjustedMonthlyContribution,
}) {
  return {
    profileKey,
    actor: "user",
    sourceFeature: "home",
    actionType: ACTION_TYPES.COMMITMENT_REVOKED,
    status: "revoked",
    commitmentId,
    supersedesEventId: supersedesEventId ?? null,
    relatedGoalIds: ["home"],
    visibility: "private",
    cause: { trigger: "user_revoked_commitment" },
    beforeSnapshot: { monthlyContribution: adjustedMonthlyContribution },
    afterSnapshot: { monthlyContribution: restoredMonthlyContribution, restoredFrom: "goal_commitment_revoke" },
    impactSet: [
      buildImpact({
        goalId: "home",
        metric: "monthlyContribution",
        before: adjustedMonthlyContribution,
        after: restoredMonthlyContribution,
        unit: "sgd_per_month",
      }),
    ],
    confidence: "high",
    messageKey: "changeLedger.event.commitment_revoked.headline",
    messageParams: { restored: restoredMonthlyContribution },
    dedupeKey: makeDedupeKey(["home", "commitment_revoked", commitmentId]),
  };
}

// Guardian pause is DERIVED live (lib/goal-commitment-finance.js) - it isn't
// a user action. When the moments route observes the execution state has
// flipped to "paused" and no open pause event exists for this commitment,
// it records this one. status "paused" (real: Guardian is really holding
// the move).
export function buildHomeCommitmentPausedEvent({
  profileKey,
  commitmentId,
  monthlyContribution,
  emergencyBufferMonths,
  emergencyFloorMonths,
}) {
  return {
    profileKey,
    actor: "guardian",
    sourceFeature: "guardian",
    actionType: ACTION_TYPES.COMMITMENT_PAUSED,
    status: "paused",
    commitmentId,
    relatedGoalIds: ["home", "emergency"],
    visibility: "private",
    cause: {
      trigger: "emergency_buffer_below_floor",
      emergencyBufferMonths,
      emergencyFloorMonths,
    },
    beforeSnapshot: { commitmentExecutionState: "active", countedMonthlyOutflow: monthlyContribution },
    afterSnapshot: { commitmentExecutionState: "paused", countedMonthlyOutflow: 0 },
    impactSet: [
      buildImpact({
        goalId: "home",
        metric: "monthlyContribution",
        before: monthlyContribution,
        after: 0,
        unit: "sgd_per_month",
      }),
      buildImpact({
        goalId: "emergency",
        metric: "emergencyBuffer",
        before: emergencyBufferMonths,
        after: emergencyBufferMonths,
        unit: "months",
        direction: "flat",
      }),
    ],
    uncertaintyNote: null,
    confidence: "high",
    messageKey: "changeLedger.event.commitment_paused.headline",
    messageParams: { threshold: emergencyFloorMonths, current: emergencyBufferMonths },
    dedupeKey: makeDedupeKey(["home", "commitment_paused", commitmentId, "below_floor"]),
  };
}
