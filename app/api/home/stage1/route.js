import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildHomeStage1SystemPrompt } from "../../../../lib/home-prompts.js";
import { CONFIRM_HOME_PLAN_TOOL, PROPOSE_HOME_PLANS_TOOL, WEB_SEARCH_TOOL } from "../../../../lib/home-tools.js";
import { buildConfirmHomePlanSchema, buildProposeHomePlansSchema } from "../../../../lib/home-validation.js";
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/home-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

export async function POST(request) {
  const body = await request.json();
  const { intent, message, language, profile, buyerProfile } = body;

  if (!VALID_INTENTS.has(intent)) {
    return Response.json({ error: "invalid_intent" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }
  if (!profile || typeof profile.monthlyIncome === "undefined") {
    return Response.json({ error: "missing_profile" }, { status: 400 });
  }

  const financialContext = {
    monthlyIncome: Number(profile.monthlyIncome),
    monthlyExpenses: Number(profile.monthlyExpenses),
    buyerType: buyerProfile?.buyerType ?? "singapore_citizen",
    existingPropertyCount: buyerProfile?.existingPropertyCount ?? 0,
    annualRatePercent: buyerProfile?.annualRatePercent ?? 3.0,
    tenureYears: buyerProfile?.tenureYears ?? 25,
  };

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
  const history = await getMessageHistory(session.id, "stage1");
  const userContent = buildFollowUpUserContent(history, message);
  const messages = [...history, { role: "user", content: userContent }];

  const client = getAnthropicClient();
  let response;
  try {
    response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 7000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildHomeStage1SystemPrompt(language),
      tools: [WEB_SEARCH_TOOL, PROPOSE_HOME_PLANS_TOOL, CONFIRM_HOME_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
  } catch (error) {
    console.error("home/stage1 Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["propose_home_plans", "confirm_home_plan"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const schema =
    toolUse.name === "propose_home_plans"
      ? buildProposeHomePlansSchema(financialContext)
      : buildConfirmHomePlanSchema(financialContext);
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("home/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: response.content },
  ]);

  const artifactType = toolUse.name === "propose_home_plans" ? "plan_options" : "confirmed_plan";
  await saveArtifact(session.id, "stage1", artifactType, parsed.data);

  if (toolUse.name === "confirm_home_plan") {
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
  }

  return Response.json({ type: toolUse.name, data: parsed.data });
}
