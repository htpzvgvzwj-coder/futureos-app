import { getCurrentUserId, resolveEffectiveProfileKey } from "../../../lib/auth.js";
import { getPreferences, savePreferences } from "../../../lib/preferences-store.js";

export const runtime = "nodejs";

// asUser= (scope "all", same convention as strategic-balance/snapshot and
// every other "view as" route) lets a grantee read a grantor's real stored
// profile - the missing piece that makes those existing "view as" routes
// actually usable, since they need the target's real monthlyIncome/
// monthlyExpenses passed in, and this was the only place that data lived.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const data = await getPreferences(resolved.profileKey);
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
