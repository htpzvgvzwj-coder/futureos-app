import { getFollowThroughSnapshot } from "../../../../lib/follow-through-context.js";
import { computeFollowThroughScore } from "../../../../lib/follow-through-finance.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

// Cross-domain aggregate - not one of the domain-scoped grants (see
// app/api/grants/route.js's scope enum), only an "all" grant unlocks "view as" here.
export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "all");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const { searchParams } = new URL(request.url);
  const everAtRisk = searchParams.get("everAtRisk") === "true";
  // Custom Goal has no server-side session (see lib/strategic-balance-context.js's identical
  // gap) - the client tells us how many it has confirmed, added on top of the domains
  // (wedding/home/retirement) this route already knows have a confirmed plan.
  const clientConfirmedGoalCount = Number(searchParams.get("customGoalCount")) || 0;

  const { domains, hardshipEvidence } = await getFollowThroughSnapshot(resolved.profileKey);
  const confirmedGoalCount = domains.length + clientConfirmedGoalCount;

  const result = computeFollowThroughScore({ domains, hardshipEvidence, everAtRisk, confirmedGoalCount });

  return Response.json({ ...result, domains, hardshipEvidenceCount: hardshipEvidence.length });
}
