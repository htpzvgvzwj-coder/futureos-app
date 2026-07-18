import {
  DEFAULT_PROFILE_KEY,
  getAppliedActions,
  getLatestArtifact,
  getOrCreateSession,
} from "../../../../lib/hardship-store.js";

export const runtime = "nodejs";

export async function GET() {
  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);

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
