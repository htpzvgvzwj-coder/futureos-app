import { getCurrentUserId } from "../../../../lib/auth.js";
import { getDebateById } from "../../../../lib/mirror-store.js";
import { computeGoalFeasibility } from "../../../../lib/mirror-finance.js";
import { getCrossGoalSnapshot, computeWholePictureImpact } from "../../../../lib/cross-goal-context.js";

export const runtime = "nodejs";

// Instant what-if branching: recomputes a real debate's Future Score and
// whole-picture impact under a hypothetical delay/monthly-amount change,
// with ZERO new AI call - reuses the exact real inputs this debate was
// generated from (mirror_debates.context, saved verbatim at generation
// time by app/api/mirror/debate/route.js / lib/mirror-chat-tools.js) and
// the same deterministic lib/mirror-finance.js + lib/cross-goal-context.js
// math the original debate used. The customer can drag a slider and see a
// real number change, not ask the AI to re-argue.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { debateId, delayMonths, monthlyOverride } = body;
  if (typeof debateId !== "string") {
    return Response.json({ error: "missing_debate_id" }, { status: 400 });
  }
  if (delayMonths != null && (typeof delayMonths !== "number" || delayMonths < 0 || delayMonths > 24)) {
    return Response.json({ error: "invalid_delay_months" }, { status: 400 });
  }
  if (monthlyOverride != null && (typeof monthlyOverride !== "number" || monthlyOverride < 0 || monthlyOverride > 500000)) {
    return Response.json({ error: "invalid_monthly_override" }, { status: 400 });
  }

  const debate = await getDebateById(userId, debateId);
  if (!debate || !debate.context?.inputs) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Same assetContext shape computeGoalFeasibility expects, reconstructed
  // from the real numbers ALREADY saved on this debate's context.computed -
  // keeps the what-if comparison apples-to-apples against the same liquid
  // savings the customer originally saw, not a possibly-since-changed figure.
  const assetContext = {
    availableLiquidSavings: debate.context.computed?.availableLiquidSavings ?? 0,
    hasActiveInsurance: debate.context.computed?.hasActiveInsurance ?? false,
  };

  const computed = computeGoalFeasibility(debate.goal_type, debate.context.inputs, assetContext, {
    delayMonths,
    monthlyOverride,
  });

  const crossGoalSnapshot = await getCrossGoalSnapshot(userId);
  computed.wholePicture = computeWholePictureImpact(computed, crossGoalSnapshot);

  return Response.json({ computed });
}
