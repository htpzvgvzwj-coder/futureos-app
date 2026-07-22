import { getCurrentUserId } from "../../../../../lib/auth.js";
import { declineJointAction } from "../../../../../lib/joint-action-store.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const declined = await declineJointAction(id, userId);
  if (!declined) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({ action: declined });
}
