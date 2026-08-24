import { z } from "zod";
import { issueCredential } from "../../../../lib/credential-store.js";
import { getStrategicBalanceSnapshot } from "../../../../lib/strategic-balance-context.js";
import { getOrCreateJourneyStart } from "../../../../lib/relationship-store.js";
import { getResolvedDebateStats, getCustomerCalibrationStats } from "../../../../lib/mirror-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

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
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = issueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  const [balanceSnapshot, relationshipStartedAt, resolvedStats, calibrationStats] = await Promise.all([
    getStrategicBalanceSnapshot(userId),
    getOrCreateJourneyStart(userId),
    getResolvedDebateStats(userId),
    getCustomerCalibrationStats(userId),
  ]);
  const confirmedGoalsCount = balanceSnapshot.loans.length + balanceSnapshot.investments.length + balanceSnapshot.savings.length;

  // Decision quality: unlike followThroughScore/reputationBand above, this
  // has a real server-side source of truth (lib/mirror-store.js, the same
  // queries /api/mirror/outcomes and Customer Calibration Score already
  // use) - independently re-derived here, never trusted from the client.
  // null (not 0) when a customer has no resolved debates yet - there is
  // nothing to certify, not a bad score.
  const decisionQuality = {
    resolvedDebateCount: resolvedStats.resolvedCount,
    aiPredictiveAccuracy: resolvedStats.resolvedCount > 0 ? Math.round((resolvedStats.correctCount / resolvedStats.resolvedCount) * 100) : null,
    customerCalibrationCount: calibrationStats.resolvedCount,
    customerCalibrationAccuracy: calibrationStats.resolvedCount > 0 ? Math.round((calibrationStats.heldUpCount / calibrationStats.resolvedCount) * 100) : null,
  };

  const snapshot = { ...parsed.data, confirmedGoalsCount, relationshipStartedAt, decisionQuality };
  const issued = await issueCredential(userId, snapshot);
  return Response.json(issued);
}
