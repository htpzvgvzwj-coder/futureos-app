import { applyGoalPause, applyDrawdownEmergencyFund, applyInvestExcess, applyOtherOcbcSupport } from "../../../../lib/hardship-actions.js";
import { DEFAULT_PROFILE_KEY, getLatestArtifact, getOrCreateSession, updateSessionStatus } from "../../../../lib/hardship-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const { selectedActionIds } = body;

  if (!Array.isArray(selectedActionIds) || selectedActionIds.length === 0) {
    return Response.json({ error: "missing_selection" }, { status: 400 });
  }

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
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

  // Best-effort sequential, not atomic: wedding/home/retirement are
  // independent Postgres session rows with no shared transaction, so true
  // cross-domain atomicity isn't available without distributed-transaction
  // machinery this app has never needed. Each action's outcome is reported
  // independently rather than pretending an all-or-nothing guarantee.
  const results = [];
  for (const action of selected) {
    try {
      let result;
      if (action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan") {
        result = await applyGoalPause({
          domain: action.target_domain,
          hardshipSessionId: session.id,
          newMonthlyContribution: action.amount,
          explanation: action.rationale,
        });
      } else if (action.action_type === "drawdown_emergency_fund") {
        result = await applyDrawdownEmergencyFund({ hardshipSessionId: session.id, amount: action.amount, explanation: action.rationale });
      } else if (action.action_type === "invest_excess") {
        result = await applyInvestExcess({ hardshipSessionId: session.id, amount: action.amount, explanation: action.rationale });
      } else {
        result = await applyOtherOcbcSupport({ hardshipSessionId: session.id, explanation: action.rationale });
      }
      results.push({ id: action.id, action_type: action.action_type, target_domain: action.target_domain, status: "applied", result });
    } catch (error) {
      console.error(`hardship/apply action failed: ${action.id}`, error);
      results.push({ id: action.id, action_type: action.action_type, target_domain: action.target_domain, status: "failed", error: error.message });
    }
  }

  await updateSessionStatus(session.id, { stage2Status: "applied" });

  return Response.json({ results });
}
