import { getReviewHistory } from "../../../../lib/decode-document-store.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// Document reviews aren't a domain-scoped grant (see app/api/grants/route.js's
// scope enum) - only an "all" grant unlocks this, same treatment as
// app/api/decision/history/route.js.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const entries = await getReviewHistory(resolved.profileKey);
  return Response.json({ entries });
}
