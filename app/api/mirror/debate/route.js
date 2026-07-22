import {
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildMirrorDebateSystemPrompt } from "../../../../lib/mirror-prompts.js";
import { FUTURE_MIRROR_DEBATE_TOOL } from "../../../../lib/mirror-tools.js";
import { mirrorDebateSchema } from "../../../../lib/mirror-validation.js";
import { computeGoalFeasibility } from "../../../../lib/mirror-finance.js";
import { saveDebate } from "../../../../lib/mirror-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

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

  // Numbers are computed here from the real inputs, never trusted from the
  // model - the AI only argues about them (lib/mirror-prompts.js).
  const computed = computeGoalFeasibility(goalType, inputs);

  const client = getAnthropicClient();
  let response;
  try {
    response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: buildMirrorDebateSystemPrompt(language, { situation, goalLabel, computed }),
      tools: [FUTURE_MIRROR_DEBATE_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: "Run the Bull/Bear/Judge debate on this plan." }],
    });
  } catch (error) {
    console.error("mirror/debate Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["future_mirror_debate"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const parsed = mirrorDebateSchema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("mirror/debate tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  const saved = await saveDebate(userId, {
    goalType,
    situation: situation ?? null,
    futureScore: computed.feasibilityScore,
    riskLevel: computed.riskLevel,
    ...parsed.data,
  });

  return Response.json({
    debateId: saved.id,
    futureScore: computed.feasibilityScore,
    riskLevel: computed.riskLevel,
    computed,
    ...parsed.data,
  });
}
