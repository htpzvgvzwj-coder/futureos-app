import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildInvestmentNarrativeSystemPrompt } from "../../../../lib/investment-prompts.js";
import { PROPOSE_INVESTMENT_NARRATIVE_TOOL, WEB_SEARCH_TOOL } from "../../../../lib/investment-tools.js";
import { proposeInvestmentNarrativeSchema } from "../../../../lib/investment-validation.js";
import { getOtherGoalsMonthlyCommitment } from "../../../../lib/investment-context.js";
import { buildMockNarrative } from "../../../../lib/investment-mock.js";
import {
  appendMessages,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
} from "../../../../lib/investment-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { intent, message, language } = body;

  if (!VALID_INTENTS.has(intent)) {
    return Response.json({ error: "invalid_intent" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }

  const session = await getOrCreateSession(userId);
  const [intake, shortlistArtifact] = await Promise.all([
    getLatestArtifact(session.id, "stage1", "intake"),
    getLatestArtifact(session.id, "stage1", "shortlist"),
  ]);
  if (!intake || !shortlistArtifact) {
    return Response.json({ error: "no_shortlist" }, { status: 400 });
  }

  const otherGoals = await getOtherGoalsMonthlyCommitment(userId);

  const history = await getMessageHistory(session.id, "stage1");
  const userContent = buildFollowUpUserContent(history, message);
  const messages = [...history, { role: "user", content: userContent }];

  const client = getAnthropicClient();
  let toolUse;
  let assistantContent;
  let mocked = false;
  try {
    const response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 5000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildInvestmentNarrativeSystemPrompt(language, {
        shortlist: shortlistArtifact.items,
        purchaseMode: intake.purchaseMode,
        riskBand: intake.riskPreference,
        goalCategory: intake.goalCategory,
        goalContext: intake.customTargetAmount ? `target SGD ${intake.customTargetAmount} over ${intake.horizonYears} years` : null,
        holdingsCategories: intake.holdingsCategories,
        availableMonthlyCashflow: otherGoals.total,
      }),
      tools: [WEB_SEARCH_TOOL, PROPOSE_INVESTMENT_NARRATIVE_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    toolUse = findToolUse(response.content, ["propose_investment_narrative"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    assistantContent = response.content;
  } catch (error) {
    console.error("investment/stage1 Anthropic call failed, falling back to mock response", error);
    const input = buildMockNarrative(shortlistArtifact.items, {
      purchaseMode: intake.purchaseMode,
      riskBand: intake.riskPreference,
      goalCategory: intake.goalCategory,
    });
    toolUse = { name: "propose_investment_narrative", input };
    mocked = true;
    assistantContent = [{ type: "tool_use", id: `mock-${Date.now()}`, name: toolUse.name, input: toolUse.input }];
  }

  const parsed = proposeInvestmentNarrativeSchema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("investment/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  // Zod alone can't express this business invariant: the AI must narrate
  // exactly the shortlist it was given, nothing added/omitted/substituted.
  const shortlistIds = shortlistArtifact.items.map((item) => item.entry_id).sort();
  const narrativeIds = parsed.data.narratives.map((n) => n.entry_id).sort();
  const idsMatch = shortlistIds.length === narrativeIds.length && shortlistIds.every((id, i) => id === narrativeIds[i]);
  if (!idsMatch) {
    console.error("investment/stage1 narrative/shortlist id mismatch", { shortlistIds, narrativeIds });
    return Response.json({ error: "narrative_shortlist_mismatch" }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);

  await saveArtifact(session.id, "stage1", "narrative", parsed.data);

  return Response.json({ type: toolUse.name, data: parsed.data, mocked });
}
