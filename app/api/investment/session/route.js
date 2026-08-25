import { getAllArtifactsWithTimestamps, getLatestArtifact, getOrCreateSession } from "../../../../lib/investment-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const session = await getOrCreateSession(userId);
  const [intake, shortlist, narrative, confirmedPickRows] = await Promise.all([
    getLatestArtifact(session.id, "stage1", "intake"),
    getLatestArtifact(session.id, "stage1", "shortlist"),
    getLatestArtifact(session.id, "stage1", "narrative"),
    getAllArtifactsWithTimestamps(session.id, "stage1", "confirmed_investment_pick"),
  ]);
  // confirmedAt is real (each row's own created_at), needed by
  // app/api/investment/outcomes/route.js to compute real elapsed holding
  // time - added here rather than changing getAllArtifacts' own shape,
  // since every other artifact-list call site in this app still expects
  // bare payloads.
  const confirmedPicks = confirmedPickRows.map((row) => ({ ...row.payload, confirmedAt: row.createdAt }));

  return Response.json({
    sessionId: session.id,
    stage1Status: session.stage1_status,
    intake,
    shortlist,
    narrative,
    confirmedPicks,
  });
}
