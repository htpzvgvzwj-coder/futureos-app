import { getAppliedActions, getLatestArtifact, getOrCreateSession } from "../../../../lib/hardship-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const session = await getOrCreateSession(userId);

  const [assessment, proposedActions, appliedActions] = await Promise.all([
    getLatestArtifact(session.id, "stage1", "hardship_assessment"),
    getLatestArtifact(session.id, "stage2", "proposed_recovery_actions"),
    getAppliedActions(session.id),
  ]);

  return Response.json({
    sessionId: session.id,
    stage1Status: session.stage1_status,
    stage2Status: session.stage2_status,
    assessment,
    proposedActions,
    appliedActions,
  });
}
