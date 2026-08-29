import { getCurrentUserId } from "../../../../../lib/auth.js";
import { getPreferences, savePreferences } from "../../../../../lib/preferences-store.js";

export const runtime = "nodejs";

// Dismiss a Decision Echo pattern. A dismissed pattern stays quiet - the
// list of dismissed pattern keys is kept in the customer's preferences
// blob (no new table) and read back by GET /api/living-plan/status.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const pattern = String(body.pattern || "").slice(0, 80);
  if (!pattern) return Response.json({ error: "missing_pattern" }, { status: 400 });

  const prefs = (await getPreferences(userId)) ?? {};
  const dismissed = new Set(prefs.dismissedEchoes ?? []);
  dismissed.add(pattern);
  await savePreferences(userId, { ...prefs, dismissedEchoes: [...dismissed] });

  return Response.json({ dismissed: [...dismissed] });
}
