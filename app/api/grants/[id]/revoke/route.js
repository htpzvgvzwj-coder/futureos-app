import { getCurrentUserId } from "../../../../../lib/auth.js";
import { revokeGrant } from "../../../../../lib/access-grant-store.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const updated = await revokeGrant(id, userId);
  if (!updated) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({ grant: updated });
}
