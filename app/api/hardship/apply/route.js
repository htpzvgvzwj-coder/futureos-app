import { applyGoalPause, applyDrawdownEmergencyFund, applyInvestExcess, applyOtherOcbcSupport } from "../../../../lib/hardship-actions.js";
import {
  DEFAULT_PROFILE_KEY,
  getAppliedActions,
  getLatestArtifact,
  getOrCreateSession,
  updateSessionStatus,
} from "../../../../lib/hardship-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const { selectedActionIds } = body;

  if (!Array.isArray(selectedActionIds) || selectedActionIds.length === 0) {
    return Response.json({ error: "missing_selection" }, { status: 400 });
  }

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);

  // A duplicate/retried request (lost response, double-click before the
  // button disables) must not re-run every action a second time - a
  // drawdown or plan pause is not safe to apply twice. Once this proposal
  // has already been applied, return the already-recorded results instead.
  if (session.stage2_status === "applied") {
    const alreadyApplied = await getAppliedActions(session.id);
    return Response.json({
      results: alreadyApplied.map((row) => ({
        id: String(row.id),
        action_type: row.action_type,
        target_domain: row.target_domain,
        status: row.status,
        amount: row.amount != null ? Number(row.amount) : null,
        explanation: row.explanation,
      })),
      alreadyApplied: true,
    });
  }

  // Re-load the proposal server-side rather than trusting a re-posted
  // payload from the client, so amounts can't be tampered with in transit.
  const proposal = await getLatestArtifact(session.id, "stage2", "proposed_recovery_actions");
  if (!proposal) {
    return Response.json({ error: "no_proposal" }, { status: 409 });
  }

  const selected = proposal.actions.filter((action) => selectedActionIds.includes(action.id));
  if (!selected.length) {
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
    selected.map(async (action) => {
      if (action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan") {
        return applyGoalPause({
          domain: action.target_domain,
          hardshipSessionId: session.id,
          newMonthlyContribution: action.amount,
          explanation: action.rationale,
        });
      }
      if (action.action_type === "drawdown_emergency_fund") {
        return applyDrawdownEmergencyFund({ hardshipSessionId: session.id, amount: action.amount, explanation: action.rationale });
      }
      if (action.action_type === "invest_excess") {
        return applyInvestExcess({ hardshipSessionId: session.id, amount: action.amount, explanation: action.rationale });
      }
      return applyOtherOcbcSupport({ hardshipSessionId: session.id, explanation: action.rationale });
    })
  );

  const results = selected.map((action, index) => {
    const outcome = settled[index];
    if (outcome.status === "rejected") {
      console.error(`hardship/apply action failed: ${action.id}`, outcome.reason);
      return {
        id: action.id,
        action_type: action.action_type,
        target_domain: action.target_domain,
        amount: action.amount,
        explanation: action.rationale,
        status: "failed",
        error: outcome.reason?.message,
      };
    }
    const result = outcome.value;
    // pause/reduce report "amount freed up" (matches the audit record);
    // every other action type reports the proposal's own amount.
    const displayAmount =
      action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan" ? result.amountFreed : action.amount;
    return {
      id: action.id,
      action_type: action.action_type,
      target_domain: action.target_domain,
      amount: displayAmount,
      explanation: action.rationale,
      status: action.action_type === "other_ocbc_support" ? "pending_review" : "applied",
      result,
    };
  });

  await updateSessionStatus(session.id, { stage2Status: "applied" });

  return Response.json({ results });
}
