import {
  DEFAULT_PROFILE_KEY,
  getLatestArtifact,
  getOrCreateSession,
  getSavingsCheckins,
} from "../../../../lib/other-store.js";

export const runtime = "nodejs";

export async function GET() {
  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);

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
