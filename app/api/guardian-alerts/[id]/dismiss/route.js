import { getCurrentUserId } from "../../../../../lib/auth.js";
import { dismissAlert } from "../../../../../lib/guardian-alert-store.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const dismissed = await dismissAlert(id, userId);
  if (!dismissed) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({ alert: dismissed });
}
