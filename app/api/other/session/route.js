import { getLatestArtifact, getOrCreateSession, getSavingsCheckins } from "../../../../lib/other-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const session = await getOrCreateSession(userId);

  const [planOptions, confirmedPlan, savingsPlanOptions, confirmedSavingsPlan, savingsCheckins] = await Promise.all([
    getLatestArtifact(session.id, "stage1", "plan_options"),
    getLatestArtifact(session.id, "stage1", "confirmed_goal_plan"),
    getLatestArtifact(session.id, "stage2", "savings_plan_options"),
    getLatestArtifact(session.id, "stage2", "confirmed_savings_plan"),
    getSavingsCheckins(session.id),
  ]);

  return Response.json({
    sessionId: session.id,
    stage1Status: session.stage1_status,
    stage2Status: session.stage2_status,
    planOptions,
    confirmedPlan,
    savingsPlanOptions,
    confirmedSavingsPlan,
    savingsCheckins,
  });
}
