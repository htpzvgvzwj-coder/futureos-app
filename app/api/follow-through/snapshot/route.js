import { getFollowThroughSnapshot } from "../../../../lib/follow-through-context.js";
import { computeFollowThroughScore } from "../../../../lib/follow-through-finance.js";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const everAtRisk = searchParams.get("everAtRisk") === "true";
  // Custom Goal has no server-side session (see lib/strategic-balance-context.js's identical
  // gap) - the client tells us how many it has confirmed, added on top of the domains
  // (wedding/home/retirement) this route already knows have a confirmed plan.
  const clientConfirmedGoalCount = Number(searchParams.get("customGoalCount")) || 0;

  const { domains, hardshipEvidence } = await getFollowThroughSnapshot();
  const confirmedGoalCount = domains.length + clientConfirmedGoalCount;

  const result = computeFollowThroughScore({ domains, hardshipEvidence, everAtRisk, confirmedGoalCount });

  return Response.json({ ...result, domains, hardshipEvidenceCount: hardshipEvidence.length });
}
