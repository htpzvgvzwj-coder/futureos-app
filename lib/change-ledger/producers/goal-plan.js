// Change Ledger producers shared by every goal-planner domain (pure).
//
// wedding / home / retirement / other / travel all confirm a stage1 plan
// and a stage2 savings plan with the same real shape. One set of event
// builders here, called from both the direct-save routes and the joint
// dispatcher (lib/goal-plan-actions.js) - no per-route copy.

import { ACTION_TYPES, buildImpact, makeDedupeKey } from "../events.js";

const DOMAIN_GOAL = {
  wedding: "wedding",
  home: "home",
  retirement: "retirement",
  other: "custom",
  travel: "travel",
};

function crossGoalImpacts(crossGoalResult) {
  if (!crossGoalResult) return [];
  const impacts = [];
  if (crossGoalResult.utilizationPercent != null) {
    impacts.push(
      buildImpact({
        goalId: "all",
        metric: "monthlyCashflow",
        before: null,
        after: null,
        unit: "percent",
        direction: crossGoalResult.utilizationPercent > 80 ? "down" : "flat",
      }),
    );
  }
  for (const loan of crossGoalResult.worseningLoans ?? []) {
    impacts.push(
      buildImpact({
        goalId: `loan:${loan.purpose}`,
        metric: "branchFeasibility",
        before: loan.scoreBefore,
        after: loan.scoreAfter,
        unit: "score",
      }),
    );
  }
  for (const inv of crossGoalResult.worseningInvestments ?? []) {
    impacts.push(
      buildImpact({
        goalId: `investment:${inv.name}`,
        metric: "branchFeasibility",
        before: inv.scoreBefore,
        after: inv.scoreAfter,
        unit: "score",
      }),
    );
  }
  return impacts;
}

// stage1: a worked plan/budget confirmed. status "scheduled" (a plan is
// committed but nothing is executing yet).
export function buildGoalPlanConfirmedEvent({ profileKey, domain, actor = "user", data, priorData = null, dedupeSuffix = null, visibility = "private" }) {
  const goalId = DOMAIN_GOAL[domain] ?? domain;
  const beforeBudget = priorData?.total_budget ?? priorData?.estimated_price ?? priorData?.target_amount ?? null;
  const afterBudget = data?.total_budget ?? data?.estimated_price ?? data?.target_amount ?? null;
  const impactSet = [];
  if (afterBudget != null) {
    impactSet.push(
      buildImpact({ goalId, metric: "planBudget", before: beforeBudget, after: afterBudget, unit: "sgd" }),
    );
  }
  return {
    profileKey,
    actor,
    sourceFeature: domain,
    actionType: ACTION_TYPES.PLAN_UPDATED,
    status: "scheduled",
    relatedGoalIds: [goalId],
    visibility,
    cause: { trigger: "stage1_plan_confirmed" },
    beforeSnapshot: priorData ? { budget: beforeBudget } : {},
    afterSnapshot: { budget: afterBudget, truthfulness: data?.truthfulness ?? "estimate" },
    impactSet,
    uncertaintyNote: afterBudget == null ? "plan_budget_not_yet_quantified" : null,
    confidence: "medium",
    messageKey: `changeLedger.event.plan_updated.${domain}`,
    messageParams: { budget: afterBudget ?? 0 },
    dedupeKey: makeDedupeKey([domain, "plan_updated", profileKey, dedupeSuffix ?? afterBudget]),
  };
}

// stage2: a savings plan (monthly contribution) confirmed. status
// "scheduled" - arranged, no real transfer. crossGoalResult is the real
// checkCrossGoalRisk output, so the cross-goal impacts are real recomputed
// Future Scores, never guesses.
export function buildSavingsPlanConfirmedEvent({ profileKey, domain, actor = "user", monthlyContribution, priorMonthlyContribution = null, targetCompleteMonth = null, crossGoalResult = null, dedupeSuffix = null, visibility = "private", isJoint = false }) {
  const goalId = DOMAIN_GOAL[domain] ?? domain;
  const impactSet = [
    buildImpact({
      goalId,
      metric: "monthlyContribution",
      before: priorMonthlyContribution,
      after: monthlyContribution,
      unit: "sgd_per_month",
    }),
    ...crossGoalImpacts(crossGoalResult),
  ];
  return {
    profileKey,
    actor,
    sourceFeature: domain,
    actionType: ACTION_TYPES.COMMITMENT_CREATED,
    status: "scheduled",
    relatedGoalIds: Array.from(new Set([goalId, ...impactSet.map((i) => i.goalId)])),
    visibility,
    planBranchId: null,
    cause: {
      trigger: isJoint ? "joint_savings_plan_confirmed" : "savings_plan_confirmed",
      crossGoalUtilizationPercent: crossGoalResult?.utilizationPercent ?? null,
    },
    beforeSnapshot: { monthlyContribution: priorMonthlyContribution },
    afterSnapshot: { monthlyContribution, targetCompleteMonth },
    impactSet,
    confidence: "high",
    messageKey: "changeLedger.event.savings_plan_confirmed.headline",
    messageParams: { domain, amount: monthlyContribution },
    dedupeKey: makeDedupeKey([domain, "savings_plan_confirmed", profileKey, dedupeSuffix ?? monthlyContribution]),
  };
}

// A joint proposal the partner declined - recorded so the initiator has a
// real trail (the brief: "共同目标中双方确认、拒绝或修改").
export function buildJointDeclinedEvent({ profileKey, domain, actor = "partner", reason = null, dedupeSuffix = null }) {
  const goalId = DOMAIN_GOAL[domain] ?? domain;
  return {
    profileKey,
    actor,
    sourceFeature: domain,
    actionType: ACTION_TYPES.JOINT_DECLINED,
    status: "revoked",
    relatedGoalIds: [goalId],
    visibility: "shared",
    cause: { trigger: "partner_declined_joint_action", reason: reason ?? null },
    beforeSnapshot: {},
    afterSnapshot: { outcome: "declined" },
    impactSet: [],
    uncertaintyNote: "joint_action_declined_no_state_change",
    confidence: "high",
    messageKey: "changeLedger.event.joint_declined.headline",
    messageParams: { domain },
    dedupeKey: makeDedupeKey([domain, "joint_declined", profileKey, dedupeSuffix]),
  };
}
