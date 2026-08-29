// Change Ledger producers for Guardian-side and evidence-side events (pure).
//   - Plan Rescue adopted (hardship apply)
//   - Quote-to-Plan import (decode-document -> plan_evidence)
//   - Shadow Guardian start / finding / end
//   - Guardian policy change

import { ACTION_TYPES, buildImpact, makeDedupeKey } from "../events.js";

// hardship apply -> one event PER applied action, each with its real
// amount + target domain. status "active" (a drawdown / pause really
// happened) or "scheduled" for a future-dated pause.
export function buildRescueAdoptedEvent({ profileKey, actionType, targetDomain, amount, proposedAmount, decisionType, explanation, hardshipSessionId, rowId }) {
  const goalId = targetDomain ?? "emergency";
  const impactSet = [];
  if (amount != null) {
    impactSet.push(
      buildImpact({
        goalId,
        metric: actionType === "drawdown_emergency_fund" ? "emergencyBuffer" : "monthlyContribution",
        before: proposedAmount ?? null,
        after: amount,
        unit: actionType === "drawdown_emergency_fund" ? "sgd" : "sgd_per_month",
      }),
    );
  }
  return {
    profileKey,
    actor: "user",
    sourceFeature: "emergency",
    actionType: ACTION_TYPES.RESCUE_ADOPTED,
    status: "active",
    relatedGoalIds: Array.from(new Set([goalId, "emergency"])),
    visibility: "private",
    cause: { trigger: "hardship_recovery_action_applied", hardshipSessionId, guardianAction: actionType, decisionType },
    beforeSnapshot: { proposedAmount: proposedAmount ?? null },
    afterSnapshot: { appliedAmount: amount ?? null, action: actionType },
    impactSet,
    uncertaintyNote: amount == null ? "rescue_action_not_monetary" : null,
    confidence: "high",
    messageKey: `changeLedger.event.rescue_adopted.${actionType}`,
    messageParams: { amount: amount ?? 0, domain: targetDomain ?? "" },
    dedupeKey: makeDedupeKey(["emergency", "rescue_adopted", rowId ?? `${hardshipSessionId}:${actionType}:${targetDomain}`]),
  };
}

// decode-document with document_type in the quote family -> a real quote
// imported into plan_evidence. The estimate range it replaces and the
// quoted figure are both real. status "active" (a real document fact now
// exists), but the PLAN impact can be unquantifiable if a required unknown
// is still missing - hence the honest uncertaintyNote path.
export function buildQuoteImportedEvent({ profileKey, domain, planId, field, label, estimateLow, estimateHigh, quotedAmount, validUntil, missingUnknown = null, documentReviewId }) {
  const goalId = domain;
  const canQuantify = missingUnknown == null && quotedAmount != null;
  const impactSet = canQuantify
    ? [
        buildImpact({
          goalId,
          metric: "planBudget",
          before: estimateLow != null && estimateHigh != null ? Math.round((estimateLow + estimateHigh) / 2) : null,
          after: quotedAmount,
          unit: "sgd",
        }),
      ]
    : [];
  return {
    profileKey,
    actor: "user",
    sourceFeature: "quote_to_plan",
    actionType: ACTION_TYPES.QUOTE_IMPORTED,
    status: "active",
    planId: planId ?? null,
    relatedGoalIds: [goalId],
    visibility: "private",
    cause: { trigger: "document_extracted", documentReviewId, field },
    beforeSnapshot: {
      field,
      truthfulness: "estimate",
      range: estimateLow != null && estimateHigh != null ? [estimateLow, estimateHigh] : null,
    },
    afterSnapshot: { field, truthfulness: "real_quote", quotedAmount, validUntil: validUntil ?? null },
    impactSet,
    evidenceRefs: [{ kind: "document", ref: documentReviewId, sourceUpdatedAt: new Date().toISOString() }],
    uncertaintyNote: canQuantify ? null : missingUnknown ? `budget_impact_pending:${missingUnknown}` : "quote_amount_not_extracted",
    confidence: canQuantify ? "high" : "medium",
    messageKey: "changeLedger.event.quote_imported.headline",
    messageParams: { label: label ?? field, quoted: quotedAmount ?? 0 },
    dedupeKey: makeDedupeKey([domain, "quote_imported", documentReviewId, field]),
  };
}

export function buildShadowEvent({ profileKey, domain, planId, phase, cyclesRun = null, finding = null, suggestedStableAmount = null, testedAmount = null }) {
  const actionType =
    phase === "start" ? ACTION_TYPES.SHADOW_STARTED : phase === "finding" ? ACTION_TYPES.SHADOW_FINDING : ACTION_TYPES.SHADOW_ENDED;
  const impactSet =
    suggestedStableAmount != null && testedAmount != null
      ? [
          buildImpact({
            goalId: domain,
            metric: "monthlyContribution",
            before: testedAmount,
            after: suggestedStableAmount,
            unit: "sgd_per_month",
          }),
        ]
      : [];
  return {
    profileKey,
    actor: "guardian",
    sourceFeature: "guardian",
    actionType,
    status: "simulated", // Shadow Guardian NEVER moves real money
    planId: planId ?? null,
    relatedGoalIds: [domain],
    visibility: "private",
    cause: { trigger: `shadow_guardian_${phase}`, cyclesRun, finding },
    beforeSnapshot: testedAmount != null ? { testedMonthlyAmount: testedAmount } : {},
    afterSnapshot: suggestedStableAmount != null ? { suggestedStableAmount } : { finding },
    impactSet,
    uncertaintyNote: impactSet.length === 0 ? "shadow_run_no_amount_delta" : null,
    confidence: "medium",
    messageKey: `changeLedger.event.shadow.${phase}`,
    messageParams: { cycles: cyclesRun ?? 0, tested: testedAmount ?? 0, stable: suggestedStableAmount ?? 0 },
    dedupeKey: makeDedupeKey([domain, "shadow", phase, planId, cyclesRun, suggestedStableAmount]),
  };
}

export function buildGuardianPolicyEvent({ profileKey, domain, planId, before, after }) {
  return {
    profileKey,
    actor: "user",
    sourceFeature: "guardian",
    actionType: ACTION_TYPES.GUARDIAN_POLICY_CHANGED,
    status: "active",
    planId: planId ?? null,
    relatedGoalIds: [domain],
    visibility: "private",
    cause: { trigger: "guardian_policy_updated" },
    beforeSnapshot: before ?? {},
    afterSnapshot: after ?? {},
    impactSet: [],
    uncertaintyNote: "policy_change_no_direct_financial_delta",
    confidence: "high",
    messageKey: "changeLedger.event.guardian_policy_changed.headline",
    messageParams: {},
    dedupeKey: makeDedupeKey([domain, "guardian_policy_changed", planId, JSON.stringify(after ?? {})]),
  };
}
