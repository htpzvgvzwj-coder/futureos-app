import { DEFAULT_PROFILE_KEY, getLatestArtifact, getOrCreateSession } from "../../../../lib/loan-store.js";

export const runtime = "nodejs";

const VALID_PURPOSES = new Set(["home", "renovation", "personal"]);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const purpose = searchParams.get("purpose");
  if (!VALID_PURPOSES.has(purpose)) {
    return Response.json({ error: "invalid_purpose" }, { status: 400 });
  }

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY, purpose);
  const [sizingOptions, confirmedLoan] = await Promise.all([
    getLatestArtifact(session.id, "stage1", "sizing_options"),
    getLatestArtifact(session.id, "stage1", "confirmed_loan"),
  ]);

  return Response.json({
    sessionId: session.id,
    stage1Status: session.stage1_status,
    sizingOptions,
    confirmedLoan,
  });
}
