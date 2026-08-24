import { getCurrentUserId } from "../../../lib/auth.js";
import { listOpenAlerts } from "../../../lib/guardian-alert-store.js";

export const runtime = "nodejs";

// Real, persisted, screen-independent proactive alerts (lib/guardian-alert-
// store.js) - checked by HomeDashboard on every real app load, not only
// when the customer happens to open a specific screen.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const alerts = await listOpenAlerts(userId);
  return Response.json({ alerts });
}
