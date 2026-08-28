import { getCurrentUserId } from "../../../../../lib/auth.js";
import { revokeCommitment } from "../../../../../lib/goal-commitment-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body?.id) return Response.json({ error: "missing_id" }, { status: 400 });

  const revoked = await revokeCommitment(body.id, userId);
  if (!revoked) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({ commitment: revoked });
}
