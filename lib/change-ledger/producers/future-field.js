// Change Ledger producers for Future Field actions (pure).
//   Peel  -> branch_created
//   Compare -> branch_compared
//   Merge -> branch_merged
//   Pin/change/release -> pin_set / pin_changed / pin_released
//   Seal -> branch_sealed  (the commitment itself is a separate
//           commitment_created event via producers/goal-plan or /home)
//   Handover -> plan_handover

import { ACTION_TYPES, buildImpact, makeDedupeKey } from "../events.js";

export function buildBranchCreatedEvent({ profileKey, domain, planId, branchId, label, baseVersion, delta, feasibility }) {
  const changed = delta?.changedKeys ?? Object.keys(delta ?? {});
  const impactSet = changed
    .filter((key) => delta?.before && delta?.after && typeof delta.after[key] === "number")
    .map((key) =>
      buildImpact({ goalId: domain, metric: key, before: delta.before[key], after: delta.after[key] }),
    );
  return {
    profileKey,
    actor: "user",
    sourceFeature: "mirror",
    actionType: ACTION_TYPES.BRANCH_CREATED,
    status: "projected", // a possible future, not confirmed
    planId: planId ?? null,
    planBranchId: branchId,
    relatedGoalIds: [domain],
    visibility: "private",
    cause: { trigger: "future_field_peel", baseVersion },
    beforeSnapshot: delta?.before ?? {},
    afterSnapshot: delta?.after ?? {},
    impactSet,
    uncertaintyNote: impactSet.length === 0 ? "branch_delta_not_numeric" : null,
    confidence: feasibility?.confidence ?? "medium",
    messageKey: "changeLedger.event.branch_created.headline",
    messageParams: { label },
    dedupeKey: makeDedupeKey([domain, "branch_created", branchId]),
  };
}

export function buildBranchMergedEvent({ profileKey, domain, planId, fromBranchIds, resultVersion, pickMap }) {
  return {
    profileKey,
    actor: "user",
    sourceFeature: "mirror",
    actionType: ACTION_TYPES.BRANCH_MERGED,
    status: "projected",
    planId: planId ?? null,
    relatedGoalIds: [domain],
    visibility: "private",
    cause: { trigger: "future_field_merge", fromBranchIds, pickMap },
    beforeSnapshot: {},
    afterSnapshot: { resultVersion },
    impactSet: [],
    uncertaintyNote: "merge_result_pending_recompute",
    confidence: "medium",
    messageKey: "changeLedger.event.branch_merged.headline",
    messageParams: {},
    dedupeKey: makeDedupeKey([domain, "branch_merged", resultVersion, (fromBranchIds ?? []).join("+")]),
  };
}

export function buildPinEvent({ profileKey, domain, planId, constraintId, kind, operator, value, phase }) {
  const actionType =
    phase === "release" ? ACTION_TYPES.PIN_RELEASED : phase === "change" ? ACTION_TYPES.PIN_CHANGED : ACTION_TYPES.PIN_SET;
  return {
    profileKey,
    actor: "user",
    sourceFeature: "mirror",
    actionType,
    status: "active", // a pin is a real, persistent rule from the moment it's set
    planId: planId ?? null,
    relatedGoalIds: domain ? [domain] : ["all"],
    visibility: "private",
    cause: { trigger: `future_field_pin_${phase ?? "set"}`, constraintId },
    beforeSnapshot: phase === "set" ? {} : { kind, previouslyActive: phase === "release" },
    afterSnapshot: phase === "release" ? { active: false } : { kind, operator, value, active: true },
    impactSet: [],
    uncertaintyNote: "constraint_shapes_future_plans_not_a_current_delta",
    confidence: "high",
    messageKey: `changeLedger.event.pin_${phase ?? "set"}.generic`,
    messageParams: { kind: `$t:changeLedger.pinKind.${kind}`, value: value ?? 0 },
    dedupeKey: makeDedupeKey([domain ?? "all", `pin_${phase ?? "set"}`, constraintId ?? kind, value]),
  };
}

export function buildBranchSealedEvent({ profileKey, domain, planId, branchId, monthlyAmount, sealPreview }) {
  return {
    profileKey,
    actor: "user",
    sourceFeature: domain,
    actionType: ACTION_TYPES.BRANCH_SEALED,
    status: sealPreview?.execution === "shadow_only" ? "simulated" : "scheduled",
    planId: planId ?? null,
    planBranchId: branchId,
    relatedGoalIds: [domain],
    visibility: "private",
    cause: { trigger: "future_field_seal", respectsPins: sealPreview?.respectsPins ?? true },
    beforeSnapshot: { branchStatus: "open" },
    afterSnapshot: { branchStatus: "sealed", monthlyAmount, execution: sealPreview?.execution ?? "shadow_only" },
    impactSet: monthlyAmount != null
      ? [buildImpact({ goalId: domain, metric: "monthlyContribution", before: 0, after: monthlyAmount, unit: "sgd_per_month" })]
      : [],
    uncertaintyNote: monthlyAmount == null ? "seal_amount_not_set" : null,
    confidence: "high",
    messageKey: "changeLedger.event.branch_sealed.headline",
    messageParams: { amount: monthlyAmount ?? 0 },
    dedupeKey: makeDedupeKey([domain, "branch_sealed", branchId]),
  };
}

export function buildHandoverEvent({ profileKey, fromDomain, toDomain, transitionType, residualAmount, transitionId }) {
  return {
    profileKey,
    actor: "system",
    sourceFeature: fromDomain,
    actionType: ACTION_TYPES.PLAN_HANDOVER,
    status: "completed",
    relatedGoalIds: Array.from(new Set([fromDomain, toDomain].filter(Boolean))),
    visibility: "private",
    cause: { trigger: "goal_completed_metamorphosis", transitionType, transitionId },
    beforeSnapshot: { goal: fromDomain, state: "completed" },
    afterSnapshot: { nextGoal: toDomain ?? null, residualAmount: residualAmount ?? null, status: "proposed" },
    impactSet:
      residualAmount != null
        ? [buildImpact({ goalId: toDomain ?? fromDomain, metric: "planBudget", before: 0, after: residualAmount, unit: "sgd" })]
        : [],
    uncertaintyNote: residualAmount == null ? "handover_residual_not_computed" : null,
    confidence: "high",
    messageKey: `changeLedger.event.plan_handover.${transitionType}`,
    messageParams: { residual: residualAmount ?? 0 },
    dedupeKey: makeDedupeKey([fromDomain, "plan_handover", transitionId ?? transitionType]),
  };
}

// The customer allocated a freed-cashflow amount. status "projected" while
// the branch is unsealed (it is a chosen possibility, not yet committed);
// the Seal event is what makes it real. impact_set carries only the legs
// that actually moved.
export function buildAllocationSetEvent({ profileKey, domain, planId, branchId, freedCashflow, allocation, allocatedImpact }) {
  const a = allocation ?? {};
  const impactSet = [];
  const home = allocatedImpact?.home;
  if (home && home.monthsDelta != null && home.monthsDelta !== 0) {
    impactSet.push(
      buildImpact({ goalId: "home", metric: "targetDate", before: 0, after: home.monthsDelta, unit: "months", direction: home.monthsDelta < 0 ? "up" : "down" }),
    );
  }
  const em = allocatedImpact?.emergency;
  if (em && em.bufferAfter != null && em.bufferBefore != null && em.bufferAfter !== em.bufferBefore) {
    impactSet.push(
      buildImpact({ goalId: "emergency", metric: "emergencyBuffer", before: em.bufferBefore, after: em.bufferAfter, unit: "months", direction: "up" }),
    );
  }
  if (Number(a.flexibleMonthly) > 0) {
    impactSet.push(
      buildImpact({ goalId: "flexible", metric: "monthlyCashflow", before: 0, after: Number(a.flexibleMonthly), unit: "sgd_per_month", direction: "up" }),
    );
  }
  return {
    profileKey,
    actor: "user",
    sourceFeature: domain,
    actionType: ACTION_TYPES.ALLOCATION_SET,
    status: "projected",
    planId: planId ?? null,
    planBranchId: branchId,
    relatedGoalIds: Array.from(new Set(["home", "emergency", "flexible", domain])),
    visibility: "private",
    cause: { trigger: "released_future_allocation", freedCashflow: Math.round(Number(freedCashflow) || 0) },
    beforeSnapshot: { freedCashflow: Math.round(Number(freedCashflow) || 0), allocated: 0 },
    afterSnapshot: {
      goalMonthly: Number(a.goalMonthly) || 0,
      emergencyMonthly: Number(a.emergencyMonthly) || 0,
      flexibleMonthly: Number(a.flexibleMonthly) || 0,
    },
    impactSet,
    uncertaintyNote: impactSet.length === 0 ? "allocation_kept_flexible_no_goal_moved" : null,
    confidence: "high",
    messageKey: "changeLedger.event.allocation_set.headline",
    messageParams: {
      home: Number(a.goalMonthly) || 0,
      emergency: Number(a.emergencyMonthly) || 0,
      flexible: Number(a.flexibleMonthly) || 0,
    },
    dedupeKey: null, // an allocation can be changed repeatedly before Seal - every change is its own record
  };
}
