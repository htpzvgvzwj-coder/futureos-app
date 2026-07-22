import { getCurrentUserId } from "../../../lib/auth.js";
import { getPreferences, savePreferences } from "../../../lib/preferences-store.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const data = await getPreferences(userId);
  return Response.json({ data });
}

export async function PUT(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  await savePreferences(userId, body);
  return Response.json({ saved: true });
}
