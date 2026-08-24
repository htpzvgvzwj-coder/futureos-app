import { runToolTurnWithFallback } from "../../../../lib/ai-fallback.js";
import { buildMirrorDebateSystemPrompt } from "../../../../lib/mirror-prompts.js";
import { FUTURE_MIRROR_DEBATE_TOOL } from "../../../../lib/mirror-tools.js";
import { mirrorDebateSchema } from "../../../../lib/mirror-validation.js";
import { computeGoalFeasibility } from "../../../../lib/mirror-finance.js";
import { saveDebate, getMirrorHistoryContext } from "../../../../lib/mirror-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";
import { listAssets } from "../../../../lib/asset-store.js";
import { computeInsuranceCoverage } from "../../../../lib/asset-finance.js";
import { resolveAvailableLiquidSavings } from "../../../../lib/liquid-savings-context.js";
import { getCrossGoalSnapshot, computeWholePictureImpact } from "../../../../lib/cross-goal-context.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { situation, goalType, goalLabel, language, inputs } = body;

  if (typeof goalType !== "string" || !inputs) {
    return Response.json({ error: "missing_goal" }, { status: 400 });
  }

  // Real Asset Profile ledger context (lib/asset-store.js) - "flexible"
  // horizon since Mirror is exploratory analysis, not an actual
  // money-committing action like a domain confirm route.
  const assets = await listAssets(userId);
  const assetContext = {
    availableLiquidSavings: await resolveAvailableLiquidSavings(userId, inputs.currentSavings, "flexible"),
    hasActiveInsurance: computeInsuranceCoverage(assets).hasActiveInsurance,
  };

  // Numbers are computed here from the real inputs, never trusted from the
  // model - the AI only argues about them (lib/mirror-prompts.js).
  const computed = computeGoalFeasibility(goalType, inputs, assetContext);

  // Whole-picture context: what this goal would do layered on top of every
  // OTHER commitment already confirmed elsewhere in the app (a home loan,
  // an investment, another goal's savings plan) - never just this goal in
  // isolation. See lib/cross-goal-context.js.
  const crossGoalSnapshot = await getCrossGoalSnapshot(userId);
  computed.wholePicture = computeWholePictureImpact(computed, crossGoalSnapshot);

  // Real self-referencing history: this customer's own resolved past
  // debates, this app's own predictive accuracy, and this customer's own
  // calibration record - passed as debate INPUT so the Bull/Bear/Judge can
  // cite real past evidence instead of arguing from nothing but this one
  // plan. See lib/mirror-store.js's getMirrorHistoryContext.
  const history = await getMirrorHistoryContext(userId);

  let result;
  try {
    result = await runToolTurnWithFallback({
      systemPrompt: buildMirrorDebateSystemPrompt(language, {
        situation,
        goalLabel,
        computed,
        isIncomeIrregular: inputs.isIncomeIrregular,
        incomeSampleSize: inputs.incomeSampleSize,
        history,
      }),
      tool: FUTURE_MIRROR_DEBATE_TOOL,
      userMessage: "Run the Bull/Bear/Judge debate on this plan.",
    });
  } catch (error) {
    console.error("mirror/debate: all configured AI providers failed", error.attempts ?? error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (result.refusal) {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  if (!result.toolInput) {
    return Response.json({ error: "inconclusive", detail: result.rawText }, { status: 422 });
  }

  const parsed = mirrorDebateSchema.safeParse(result.toolInput);
  if (!parsed.success) {
    console.error("mirror/debate tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  // The real snapshot this specific debate was generated from - inputs the
  // customer entered, the server-computed feasibility numbers, and which AI
  // provider actually answered (fallback may mean it wasn't Anthropic). Saved
  // verbatim, never recomputed later, so a future "why did it say this" view
  // shows the literal facts used at generation time.
  const saved = await saveDebate(userId, {
    goalType,
    situation: situation ?? null,
    futureScore: computed.feasibilityScore,
    riskLevel: computed.riskLevel,
    context: { inputs, computed, goalLabel, language, history },
    aiProvider: result.provider,
    ...parsed.data,
  });

  return Response.json({
    debateId: saved.id,
    futureScore: computed.feasibilityScore,
    riskLevel: computed.riskLevel,
    computed,
    aiProvider: result.provider,
    history,
    ...parsed.data,
  });
}
