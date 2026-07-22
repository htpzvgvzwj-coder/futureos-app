import { applyGoalPause, applyDrawdownEmergencyFund, applyInvestExcess, applyOtherOcbcSupport } from "../../../../lib/hardship-actions.js";
import {
  getAppliedActions,
  getLatestArtifact,
  getOrCreateSession,
  recordRejectedAction,
  updateSessionStatus,
} from "../../../../lib/hardship-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
const VALID_DECISIONS = new Set(["approve", "edit", "reject"]);

function toAppliedActionRow(row) {
  return {
    id: String(row.id),
    action_type: row.action_type,
    target_domain: row.target_domain,
    status: row.status,
    amount: row.amount != null ? Number(row.amount) : null,
    proposed_amount: row.proposed_amount != null ? Number(row.proposed_amount) : null,
    explanation: row.explanation,
    decision_type: row.decision_type,
    decision_reason: row.decision_reason,
  };
}

// Four-state approval (approve/edit/reject) instead of a plain selected-or-not
// list - a declined proposal must leave a reason behind, and an edited amount
// must be recorded against what Guardian originally proposed, so both can
// later feed a Follow-Through Score "judgment/calibration" dimension instead
// of vanishing the moment the customer decides.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { decisions } = body;

  if (!Array.isArray(decisions) || decisions.length === 0) {
    return Response.json({ error: "missing_selection" }, { status: 400 });
  }
  for (const entry of decisions) {
    if (!entry || typeof entry.actionId !== "string" || !VALID_DECISIONS.has(entry.decision)) {
      return Response.json({ error: "invalid_decision" }, { status: 422 });
    }
    if (entry.decision === "edit" && !(Number.isFinite(entry.editedAmount) && entry.editedAmount > 0)) {
      return Response.json({ error: "invalid_edited_amount" }, { status: 422 });
    }
  }

  const session = await getOrCreateSession(userId);

  // A duplicate/retried request (lost response, double-click before the
  // button disables) must not re-run every action a second time - a
  // drawdown or plan pause is not safe to apply twice. Once this proposal
  // has already been applied, return the already-recorded results instead.
  if (session.stage2_status === "applied") {
    const alreadyApplied = await getAppliedActions(session.id);
    return Response.json({ results: alreadyApplied.map(toAppliedActionRow), alreadyApplied: true });
  }

  // Re-load the proposal server-side rather than trusting a re-posted
  // payload from the client, so amounts can't be tampered with in transit.
  const proposal = await getLatestArtifact(session.id, "stage2", "proposed_recovery_actions");
  if (!proposal) {
    return Response.json({ error: "no_proposal" }, { status: 409 });
  }

  const decisionById = new Map(decisions.map((entry) => [entry.actionId, entry]));
  const decided = proposal.actions
    .filter((action) => decisionById.has(action.id))
    .map((action) => ({ action, decision: decisionById.get(action.id) }));
  if (!decided.length) {
    return Response.json({ error: "no_matching_actions" }, { status: 400 });
  }

  // Best-effort, not atomic: wedding/home/retirement are independent
  // Postgres session rows with no shared transaction, so true cross-domain
  // atomicity isn't available without distributed-transaction machinery
  // this app has never needed. Each action's outcome is reported
  // independently rather than pretending an all-or-nothing guarantee. Run
  // concurrently via allSettled (not sequentially) since each action's
  // error is already isolated - one failing must not delay or block another.
  const settled = await Promise.allSettled(
    decided.map(async ({ action, decision }) => {
      if (decision.decision === "reject") {
        return recordRejectedAction(session.id, {
          actionType: action.action_type,
          targetDomain: action.target_domain,
          proposedAmount: action.amount,
          explanation: action.rationale,
          reason: decision.reason ?? null,
        });
      }

      const decisionType = decision.decision;
      const decisionReason = decision.reason ?? null;
      const amount = decisionType === "edit" ? decision.editedAmount : action.amount;

      if (action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan") {
        return applyGoalPause({
          domain: action.target_domain,
          hardshipSessionId: session.id,
          newMonthlyContribution: amount,
          explanation: action.rationale,
          profileKey: userId,
          decisionType,
          decisionReason,
          proposedAmount: action.amount,
        });
      }
      if (action.action_type === "drawdown_emergency_fund") {
        return applyDrawdownEmergencyFund({ hardshipSessionId: session.id, amount, explanation: action.rationale, decisionType, decisionReason, proposedAmount: action.amount });
      }
      if (action.action_type === "invest_excess") {
        return applyInvestExcess({ hardshipSessionId: session.id, amount, explanation: action.rationale, decisionType, decisionReason, proposedAmount: action.amount });
      }
      return applyOtherOcbcSupport({ hardshipSessionId: session.id, explanation: action.rationale, decisionType, decisionReason, proposedAmount: action.amount });
    })
  );

  const results = decided.map(({ action, decision }, index) => {
    const outcome = settled[index];
    if (outcome.status === "rejected") {
      console.error(`hardship/apply action failed: ${action.id}`, outcome.reason);
      return {
        id: action.id,
        action_type: action.action_type,
        target_domain: action.target_domain,
        amount: action.amount,
        proposed_amount: action.amount,
        explanation: action.rationale,
        status: "failed",
        decision_type: decision.decision,
        decision_reason: decision.reason ?? null,
        error: outcome.reason?.message,
      };
    }
    if (decision.decision === "reject") {
      return {
        id: action.id,
        action_type: action.action_type,
        target_domain: action.target_domain,
        amount: null,
        proposed_amount: action.amount,
        explanation: action.rationale,
        status: "rejected",
        decision_type: "reject",
        decision_reason: decision.reason ?? null,
      };
    }
    const result = outcome.value;
    // pause/reduce report "amount freed up" (matches the audit record);
    // every other action type reports the proposal's own amount.
    const displayAmount =
      action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan" ? result.amountFreed : (decision.decision === "edit" ? decision.editedAmount : action.amount);
    return {
      id: action.id,
      action_type: action.action_type,
      target_domain: action.target_domain,
      amount: displayAmount,
      proposed_amount: action.amount,
      explanation: action.rationale,
      status: action.action_type === "other_ocbc_support" ? "pending_review" : "applied",
      decision_type: decision.decision,
      decision_reason: decision.reason ?? null,
      result,
    };
  });

  await updateSessionStatus(session.id, { stage2Status: "applied" });

  return Response.json({ results });
}
