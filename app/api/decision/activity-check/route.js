import { runToolTurnWithFallback } from "../../../../lib/ai-fallback.js";
import { buildActivityCheckSystemPrompt } from "../../../../lib/activity-check-prompts.js";
import { NARRATE_ACTIVITY_CHECK_TOOL } from "../../../../lib/activity-check-tools.js";
import { activityCheckRequestSchema, narrateActivityCheckSchema } from "../../../../lib/activity-check-validation.js";
import { computeActivityCheck } from "../../../../lib/activity-check-finance.js";
import { buildMockActivityCheckNarration } from "../../../../lib/activity-check-mock.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// Real, deterministic "is this unusual for you" check - the verdict is
// fully decided by lib/activity-check-finance.js, from the customer's own
// real confirmed history, before any Anthropic call is made. No
// persistence - this is a stateless point-of-decision check, same shape
// as /api/decision/check.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = activityCheckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const { description, amount, monthlyIncome, language } = parsed.data;

  const check = await computeActivityCheck(userId, { amount, monthlyIncome });

  let narration;
  let mocked = false;
  try {
    const result = await runToolTurnWithFallback({
      systemPrompt: buildActivityCheckSystemPrompt(language, check, description),
      tool: NARRATE_ACTIVITY_CHECK_TOOL,
      userMessage: description,
    });
    if (result.refusal) {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    if (!result.toolInput) {
      return Response.json({ error: "inconclusive", detail: result.rawText }, { status: 422 });
    }
    const parsedNarration = narrateActivityCheckSchema.safeParse(result.toolInput);
    if (!parsedNarration.success) {
      console.error("decision/activity-check tool output failed validation", parsedNarration.error.issues);
      return Response.json({ error: "validation_failed", detail: parsedNarration.error.issues }, { status: 422 });
    }
    narration = parsedNarration.data;
  } catch (error) {
    console.error("decision/activity-check: all configured AI providers failed, falling back to mock response", error.attempts ?? error);
    narration = buildMockActivityCheckNarration(check);
    mocked = true;
  }

  return Response.json({
    description,
    check,
    narrative: narration.narrative,
    keyConsideration: narration.key_consideration,
    mocked,
  });
}
