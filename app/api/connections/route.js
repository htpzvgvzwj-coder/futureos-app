import { getCurrentUserId } from "../../../lib/auth.js";
import { guard } from "../../../lib/http-guards.js";
import { getConnections, connectProvider, disconnectProvider } from "../../../lib/connections/store.js";

export const runtime = "nodejs";

// GET /api/connections -> the three outside-data links, their status, and
// (when connected) the pulled detail so the user can open and check it.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json({ connections: await getConnections(userId) });
  } catch (error) {
    console.error("[connections] GET failed:", error?.message);
    return Response.json({ error: "connections_unavailable" }, { status: 500 });
  }
}

// POST /api/connections  { action: "connect" | "disconnect", provider }
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "connections", limit: 20 });
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "connect") {
      return Response.json({ connections: await connectProvider(userId, body.provider) });
    }
    if (body.action === "disconnect") {
      return Response.json({ connections: await disconnectProvider(userId, body.provider) });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
