import { getCurrentUserId } from "../../../../../lib/auth.js";
import { revokeCommitment } from "../../../../../lib/goal-commitment-store.js";
import { getOrCreateSession, saveArtifact, updateSessionStatus } from "../../../../../lib/home-store.js";
import { buildRevertSavingsPlanPayload } from "../../../../../lib/plan-runtime/commitment.js";
import { recordEventSafe, getLatestEventForCommitment } from "../../../../../lib/change-ledger/store.js";
import { buildHomeCommitmentRevokedEvent } from "../../../../../lib/change-ledger/producers/home.js";
import { ACTION_TYPES } from "../../../../../lib/change-ledger/events.js";

export const runtime = "nodejs";

// Revoke doesn't just flip goal_commitments.status - it restores the
// confirmed_savings_plan that was in force before this commitment adjusted
// it (captured verbatim at create time as superseded_savings_plan). Without
// this, every downstream consumer - Strategic Balance, Loan Planner's
// otherGoalsMonthlyOutflow, hardship, follow-through, open-loops - keeps
// reading Guardian's adjusted monthly_contribution as an active commitment
// even after the customer cancelled it.
//
// The revoke is also its own Change Ledger event that SUPERSEDES the create
// event - history is never deleted, the original change is shown "no longer
// in effect".
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body?.id) return Response.json({ error: "missing_id" }, { status: 400 });

  const revoked = await revokeCommitment(body.id, userId);
  if (!revoked) return Response.json({ error: "not_found" }, { status: 404 });

  const language = body.language === "zh" ? "zh" : "en";
  let restoredSavingsPlan = false;
  const revertPayload = buildRevertSavingsPlanPayload({
    supersededPlan: revoked.superseded_savings_plan,
    notes:
      language === "zh"
        ? "已取消 Guardian 的节奏调整，恢复到调整前确认的储蓄计划。"
        : "Guardian's pace adjustment was cancelled; restored to the savings plan confirmed before it.",
  });
  if (revertPayload) {
    const homeSession = await getOrCreateSession(userId);
    await saveArtifact(homeSession.id, "stage2", "confirmed_savings_plan", revertPayload);
    await updateSessionStatus(homeSession.id, { stage2Status: "confirmed" });
    restoredSavingsPlan = true;
  }

  const createEvent = await getLatestEventForCommitment(userId, revoked.id, ACTION_TYPES.COMMITMENT_CREATED);
  const ledger = await recordEventSafe(
    buildHomeCommitmentRevokedEvent({
      profileKey: userId,
      commitmentId: revoked.id,
      supersedesEventId: createEvent?.id ?? null,
      restoredMonthlyContribution: Number(
        revoked.prior_monthly_contribution ?? revoked.superseded_savings_plan?.monthly_contribution ?? 0,
      ),
      adjustedMonthlyContribution: Number(revoked.monthly_contribution),
    }),
  );

  return Response.json({ commitment: revoked, restoredSavingsPlan, ledgerEventId: ledger?.event?.id ?? null });
}
