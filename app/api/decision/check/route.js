import { runToolTurnWithFallback } from "../../../../lib/ai-fallback.js";
import { buildDecisionNarrationSystemPrompt } from "../../../../lib/decision-prompts.js";
import { NARRATE_VERDICT_TOOL } from "../../../../lib/decision-tools.js";
import { decisionCheckRequestSchema, narrateVerdictSchema } from "../../../../lib/decision-validation.js";
import { computeDecisionVerdict } from "../../../../lib/decision-finance.js";
import { buildMockNarration } from "../../../../lib/decision-mock.js";
import { saveCheck } from "../../../../lib/decision-store.js";
import { getOtherGoalsMonthlyCommitment } from "../../../../lib/investment-context.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// The verdict itself never depends on the AI call succeeding - it's fully decided by
// lib/decision-finance.js before any Anthropic call is made, which is what lets this endpoint
// answer instantly (with a mock narration) even with zero API credits, exactly the point of a
// point-of-decision tool a customer might use standing in a shop.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = decisionCheckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const { description, amount, recurringMonthly, monthlyIncome, monthlyExpenses, currentSavings, language } = parsed.data;

  const otherGoals = await getOtherGoalsMonthlyCommitment(userId);

  const verdict = computeDecisionVerdict({
    amount,
    recurringMonthly,
    monthlyIncome,
    monthlyExpenses,
    currentSavings,
    otherGoalsMonthlyOutflow: otherGoals.total,
  });

  // anthropic -> groq -> gemini (lib/ai-fallback.js) before ever falling
  // back to the local mock below - decision/check is a genuine single-shot
  // call (no conversation history to translate across providers), the same
  // shape Mirror debate and Decode This already use.
  let narration;
  let mocked = false;
  try {
    const result = await runToolTurnWithFallback({
      systemPrompt: buildDecisionNarrationSystemPrompt(language, verdict, description),
      tool: NARRATE_VERDICT_TOOL,
      userMessage: description,
    });
    if (result.refusal) {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    if (!result.toolInput) {
      return Response.json({ error: "inconclusive", detail: result.rawText }, { status: 422 });
    }
    const parsedNarration = narrateVerdictSchema.safeParse(result.toolInput);
    if (!parsedNarration.success) {
      console.error("decision/check tool output failed validation", parsedNarration.error.issues);
      return Response.json({ error: "validation_failed", detail: parsedNarration.error.issues }, { status: 422 });
    }
    narration = parsedNarration.data;
  } catch (error) {
    console.error("decision/check: all configured AI providers failed, falling back to mock response", error.attempts ?? error);
    narration = buildMockNarration(verdict.verdict);
    mocked = true;
  }

  const saved = await saveCheck(userId, {
    description,
    verdict,
    narrative: narration.narrative,
    keyConsideration: narration.key_consideration,
    mocked,
  });

  return Response.json({
    id: saved.id,
    createdAt: saved.createdAt,
    verdict,
    narrative: narration.narrative,
    keyConsideration: narration.key_consideration,
    mocked,
  });
}
