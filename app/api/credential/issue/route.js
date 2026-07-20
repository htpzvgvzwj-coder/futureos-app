import { z } from "zod";
import { DEFAULT_PROFILE_KEY, issueCredential } from "../../../../lib/credential-store.js";
import { getStrategicBalanceSnapshot } from "../../../../lib/strategic-balance-context.js";
import { getOrCreateJourneyStart } from "../../../../lib/relationship-store.js";

export const runtime = "nodejs";

// followThroughScore/reputationBand/relationshipTier are client-only signals (they depend on
// preferences/simulatorInputs/simulatorActionStates, which have no server-side source of truth in
// this prototype) - trusted context the same way monthlyIncome is trusted elsewhere in this app.
// confirmedGoalsCount and relationshipStartedAt are real, independently re-derived server-side
// rather than trusted from the client, since those DO have a backend source of truth.
const issueRequestSchema = z.object({
  followThroughScore: z.number().min(0).max(100),
  followThroughBand: z.string().min(1),
  reputationScore: z.number().min(0).max(100),
  reputationBand: z.string().min(1),
  relationshipTier: z.number().int().min(0).max(3),
});

export async function POST(request) {
  const body = await request.json();
  const parsed = issueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  const [balanceSnapshot, relationshipStartedAt] = await Promise.all([
    getStrategicBalanceSnapshot(),
    getOrCreateJourneyStart(DEFAULT_PROFILE_KEY),
  ]);
  const confirmedGoalsCount = balanceSnapshot.loans.length + balanceSnapshot.investments.length + balanceSnapshot.savings.length;

  const snapshot = { ...parsed.data, confirmedGoalsCount, relationshipStartedAt };
  const issued = await issueCredential(DEFAULT_PROFILE_KEY, snapshot);
  return Response.json(issued);
}
