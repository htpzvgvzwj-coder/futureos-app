import { getOrCreateJourneyStart } from "../../../../lib/relationship-store.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// Not one of the domain-scoped grants (see app/api/grants/route.js's scope enum) -
// only an "all" grant unlocks "view as" here.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const startedAt = await getOrCreateJourneyStart(resolved.profileKey);
  return Response.json({ startedAt });
}
