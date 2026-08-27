import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildTravelStage1SystemPrompt } from "../../../../lib/travel-prompts.js";
import { CONFIRM_TRAVEL_PLAN_TOOL, PROPOSE_TRAVEL_PLANS_TOOL } from "../../../../lib/travel-tools.js";
import { WEB_SEARCH_TOOL } from "../../../../lib/wedding-tools.js";
import { confirmTravelPlanSchema, proposeTravelPlansSchema } from "../../../../lib/travel-validation.js";
import { buildMockTravelConfirmation, buildMockTravelPlanOptions, looksLikeConfirmation } from "../../../../lib/travel-mock.js";
import {
  appendMessages,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/travel-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";
import { findActGrantor } from "../../../../lib/access-grant-store.js";
import { proposeJointAction } from "../../../../lib/joint-action-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

// Mirrors app/api/wedding/stage1/route.js's mock fallback - only reached
// when the real Anthropic call itself fails.
async function buildMockToolUse(message, sessionId) {
  const previousPlanOptions = await getLatestArtifact(sessionId, "stage1", "plan_options");
  if (looksLikeConfirmation(message) && previousPlanOptions) {
    return { name: "confirm_travel_plan", input: buildMockTravelConfirmation(message, previousPlanOptions) };
  }
  return { name: "propose_travel_plans", input: buildMockTravelPlanOptions() };
}

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
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildTravelStage1SystemPrompt(language),
      tools: [WEB_SEARCH_TOOL, PROPOSE_TRAVEL_PLANS_TOOL, CONFIRM_TRAVEL_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal" }, { status: 422 });
    }
    toolUse = findToolUse(response.content, ["propose_travel_plans", "confirm_travel_plan"]);
    if (!toolUse) {
      return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
    }
    assistantContent = response.content;
  } catch (error) {
    console.error("travel/stage1 Anthropic call failed, falling back to mock response", error);
    toolUse = await buildMockToolUse(message, session.id);
    mocked = true;
    assistantContent = [{ type: "tool_use", id: `mock-${Date.now()}`, name: toolUse.name, input: toolUse.input }];
  }

  const schema = toolUse.name === "propose_travel_plans" ? proposeTravelPlansSchema : confirmTravelPlanSchema;
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("travel/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);

  // Joint (family) confirmation: same pattern as wedding/home/retirement/
  // other's stage1 - if a family member has granted this user
  // "view_and_act" on the travel domain, the confirmed plan isn't saved
  // directly, it's proposed as a joint action. No grant -> unchanged
  // direct-save behavior below.
  if (toolUse.name === "confirm_travel_plan") {
    const grantor = await findActGrantor(userId, "travel");
    if (grantor) {
      try {
        const action = await proposeJointAction({
          initiatorUserId: userId,
          targetUserId: grantor.grantor_user_id,
          domain: "travel",
          actionType: "confirm_travel_plan",
          payload: { kind: "plan", ...parsed.data },
        });
        return Response.json({
          type: toolUse.name,
          status: "pending_partner_confirmation",
          jointActionId: action.id,
          data: parsed.data,
          mocked,
        });
      } catch (error) {
        if (error.code !== "no_joint_grant") throw error;
      }
    }
  }

  const artifactType = toolUse.name === "propose_travel_plans" ? "plan_options" : "confirmed_budget";
  const createdAt = await saveArtifact(session.id, "stage1", artifactType, parsed.data);

  if (toolUse.name === "confirm_travel_plan") {
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
  }

  return Response.json({
    type: toolUse.name,
    data: parsed.data,
    confirmedAt: toolUse.name === "confirm_travel_plan" ? createdAt : undefined,
    mocked,
  });
}
