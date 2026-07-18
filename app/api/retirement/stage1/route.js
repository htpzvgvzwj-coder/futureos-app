import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildRetirementStage1SystemPrompt } from "../../../../lib/retirement-prompts.js";
import { CONFIRM_RETIREMENT_PLAN_TOOL, PROPOSE_RETIREMENT_PLANS_TOOL, WEB_SEARCH_TOOL } from "../../../../lib/retirement-tools.js";
import { buildConfirmRetirementPlanSchema, buildProposeRetirementPlansSchema } from "../../../../lib/retirement-validation.js";
import { estimateCurrentCpfBalances } from "../../../../lib/retirement-finance.js";
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/retirement-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_INTENTS = new Set(["generate", "refine"]);

export async function POST(request) {
  const body = await request.json();
  const { intent, message, language, profile, retirementProfile } = body;

  if (!VALID_INTENTS.has(intent)) {
    return Response.json({ error: "invalid_intent" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }
  if (!profile || typeof profile.monthlyIncome === "undefined") {
    return Response.json({ error: "missing_profile" }, { status: 400 });
  }

  const currentAge = Number(retirementProfile?.currentAge ?? profile.age ?? 30);
  const retirementAge = Number(retirementProfile?.retirementAge ?? 65);
  const monthlyIncome = Number(profile.monthlyIncome);
  const currentBalances =
    retirementProfile?.cpfBalances ?? estimateCurrentCpfBalances({ currentAge, monthlyIncome });

  const financialContext = { currentAge, retirementAge, currentBalances, monthlyIncome };

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
      system: buildRetirementStage1SystemPrompt(language),
      tools: [WEB_SEARCH_TOOL, PROPOSE_RETIREMENT_PLANS_TOOL, CONFIRM_RETIREMENT_PLAN_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
  } catch (error) {
    console.error("retirement/stage1 Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["propose_retirement_plans", "confirm_retirement_plan"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const schema =
    toolUse.name === "propose_retirement_plans"
      ? buildProposeRetirementPlansSchema(financialContext)
      : buildConfirmRetirementPlanSchema(financialContext);
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("retirement/stage1 tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: response.content },
  ]);

  const artifactType = toolUse.name === "propose_retirement_plans" ? "plan_options" : "confirmed_plan";
  await saveArtifact(session.id, "stage1", artifactType, parsed.data);

  if (toolUse.name === "confirm_retirement_plan") {
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
  }

  return Response.json({ type: toolUse.name, data: parsed.data });
}
