import { getCurrentUserId } from "../../../../lib/auth.js";
import { listInitiatedJointActions } from "../../../../lib/joint-action-store.js";

export const runtime = "nodejs";

// What THIS user has proposed to someone else, with its real current status
// (pending/confirmed/declined) - previously there was no way for an
// initiator to see this at all. See lib/joint-action-store.js.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const proposed = await listInitiatedJointActions(userId);
  return Response.json({ proposed });
}
