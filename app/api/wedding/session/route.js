import { DEFAULT_PROFILE_KEY, getLatestArtifact, getOrCreateSession } from "../../../../lib/wedding-store.js";

export const runtime = "nodejs";

export async function GET() {
  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);

  const [planOptions, confirmedBudget, savingsPlanOptions, confirmedSavingsPlan] = await Promise.all([
    getLatestArtifact(session.id, "stage1", "plan_options"),
    getLatestArtifact(session.id, "stage1", "confirmed_budget"),
    getLatestArtifact(session.id, "stage2", "savings_plan_options"),
    getLatestArtifact(session.id, "stage2", "confirmed_savings_plan"),
  ]);

  return Response.json({
    sessionId: session.id,
    stage1Status: session.stage1_status,
    stage2Status: session.stage2_status,
    planOptions,
    confirmedBudget,
    savingsPlanOptions,
    confirmedSavingsPlan,
  });
}
