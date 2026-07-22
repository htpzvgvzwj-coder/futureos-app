import { getAllArtifacts, getLatestArtifact, getOrCreateSession } from "../../../../lib/investment-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const session = await getOrCreateSession(userId);
  const [intake, shortlist, narrative, confirmedPicks] = await Promise.all([
    getLatestArtifact(session.id, "stage1", "intake"),
    getLatestArtifact(session.id, "stage1", "shortlist"),
    getLatestArtifact(session.id, "stage1", "narrative"),
    getAllArtifacts(session.id, "stage1", "confirmed_investment_pick"),
  ]);

  return Response.json({
    sessionId: session.id,
    stage1Status: session.stage1_status,
    intake,
    shortlist,
    narrative,
    confirmedPicks,
  });
}
