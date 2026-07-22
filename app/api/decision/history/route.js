import { getHistory } from "../../../../lib/decision-store.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// Decision checks aren't one of the domain-scoped grants (see app/api/grants/route.js's
// scope enum) - only an "all" grant unlocks this, same treatment as the cross-domain
// aggregates below.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const entries = await getHistory(resolved.profileKey);
  return Response.json({ entries });
}
