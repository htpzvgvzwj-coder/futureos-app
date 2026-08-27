import { runToolTurnWithFallback } from "../../../../lib/ai-fallback.js";
import { buildCashflowSystemPrompt } from "../../../../lib/sme-cashflow-prompts.js";
import { NARRATE_CASHFLOW_TOOL } from "../../../../lib/sme-cashflow-tools.js";
import { smeCashflowRequestSchema, narrateCashflowSchema } from "../../../../lib/sme-cashflow-validation.js";
import { computeCashFlowForecast } from "../../../../lib/sme-cashflow-finance.js";
import { buildMockCashflowNarration } from "../../../../lib/sme-cashflow-mock.js";
import { getProfile, saveProfile } from "../../../../lib/sme-cashflow-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET returns the owner's saved profile plus a freshly recomputed real
// forecast (deterministic, instant - the events don't change between
// requests) and the last AI narration, without paying for a new AI call
// on every page load.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const profile = await getProfile(userId);
  if (!profile) return Response.json({ profile: null });

  const forecast = computeCashFlowForecast({
    startingCash: profile.startingCash,
    events: profile.events,
    horizonDays: 30,
  });

  return Response.json({
    profile: {
      businessName: profile.businessName,
      startingCash: profile.startingCash,
      events: profile.events,
      updatedAt: profile.updatedAt,
    },
    forecast,
    narrative: profile.narrative,
    keyConsideration: profile.keyConsideration,
    mocked: profile.mocked,
  });
}

// PUT saves the owner's real events and returns a fresh real forecast plus
// a fresh AI narration - the forecast itself is fully decided before any
// Anthropic call is made, same "answer instantly even with zero AI
// credits" property every other point-of-decision tool in this app has.
export async function PUT(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = smeCashflowRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const { businessName, startingCash, events, horizonDays, language } = parsed.data;

  const forecast = computeCashFlowForecast({ startingCash, events, horizonDays });

  let narration;
  let mocked = false;
  try {
    const result = await runToolTurnWithFallback({
      systemPrompt: buildCashflowSystemPrompt(language, forecast, businessName),
      tool: NARRATE_CASHFLOW_TOOL,
      userMessage: `Cash flow check for ${businessName}.`,
    });
    if (result.refusal) {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    if (!result.toolInput) {
      return Response.json({ error: "inconclusive", detail: result.rawText }, { status: 422 });
    }
    const parsedNarration = narrateCashflowSchema.safeParse(result.toolInput);
    if (!parsedNarration.success) {
      console.error("sme/cashflow tool output failed validation", parsedNarration.error.issues);
      return Response.json({ error: "validation_failed", detail: parsedNarration.error.issues }, { status: 422 });
    }
    narration = parsedNarration.data;
  } catch (error) {
    console.error("sme/cashflow: all configured AI providers failed, falling back to mock response", error.attempts ?? error);
    narration = buildMockCashflowNarration(forecast);
    mocked = true;
  }

  const updatedAt = await saveProfile(userId, {
    businessName,
    startingCash,
    events,
    narrative: narration.narrative,
    keyConsideration: narration.key_consideration,
    mocked,
  });

  return Response.json({
    profile: { businessName, startingCash, events, updatedAt },
    forecast,
    narrative: narration.narrative,
    keyConsideration: narration.key_consideration,
    mocked,
  });
}
