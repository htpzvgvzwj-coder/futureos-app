import { runToolTurnWithFallback } from "../../../../lib/ai-fallback.js";
import { buildFutureComparisonSystemPrompt } from "../../../../lib/future-comparison-prompts.js";
import { NARRATE_FUTURE_COMPARISON_TOOL } from "../../../../lib/future-comparison-tools.js";
import { futureComparisonRequestSchema, narrateFutureComparisonSchema } from "../../../../lib/future-comparison-validation.js";
import { computeFutureComparison } from "../../../../lib/future-comparison-finance.js";
import { buildMockFutureComparisonNarration } from "../../../../lib/future-comparison-mock.js";
import { saveComparison } from "../../../../lib/future-comparison-store.js";
import { resolveAvailableLiquidSavings } from "../../../../lib/liquid-savings-context.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// Both real futures are fully decided by lib/future-comparison-finance.js before any Anthropic
// call is made, same "answer instantly even with zero AI credits" property decision/check has.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = futureComparisonRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const { description, amount, recurringMonthly, horizonMonths, monthlyIncome, monthlyExpenses, currentSavings, language } = parsed.data;

  // Server-truth available liquid savings instead of the raw client-sent
  // figure, same honesty-audit discipline every domain confirm route
  // already applies (lib/liquid-savings-context.js) - "flexible" horizon
  // since this is exploratory, not a money-committing action.
  const realCurrentSavings = await resolveAvailableLiquidSavings(userId, currentSavings, "flexible");

  const comparison = await computeFutureComparison(userId, {
    amount,
    recurringMonthly,
    horizonMonths,
    monthlyIncome,
    monthlyExpenses,
    currentSavings: realCurrentSavings,
  });

  let narration;
  let mocked = false;
  try {
    const result = await runToolTurnWithFallback({
      systemPrompt: buildFutureComparisonSystemPrompt(language, comparison, description),
      tool: NARRATE_FUTURE_COMPARISON_TOOL,
      userMessage: description,
    });
    if (result.refusal) {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    if (!result.toolInput) {
      return Response.json({ error: "inconclusive", detail: result.rawText }, { status: 422 });
    }
    const parsedNarration = narrateFutureComparisonSchema.safeParse(result.toolInput);
    if (!parsedNarration.success) {
      console.error("decision/future-comparison tool output failed validation", parsedNarration.error.issues);
      return Response.json({ error: "validation_failed", detail: parsedNarration.error.issues }, { status: 422 });
    }
    narration = parsedNarration.data;
  } catch (error) {
    console.error("decision/future-comparison: all configured AI providers failed, falling back to mock response", error.attempts ?? error);
    narration = buildMockFutureComparisonNarration(comparison.savingsDelta);
    mocked = true;
  }

  const saved = await saveComparison(userId, {
    description,
    comparison,
    narrative: narration.narrative,
    keyConsideration: narration.key_consideration,
    mocked,
  });

  return Response.json({
    id: saved.id,
    createdAt: saved.createdAt,
    description,
    comparison,
    narrative: narration.narrative,
    keyConsideration: narration.key_consideration,
    mocked,
  });
}
