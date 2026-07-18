import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildHardshipAssessmentSystemPrompt } from "../../../../lib/hardship-prompts.js";
import { ASSESS_HARDSHIP_TOOL } from "../../../../lib/hardship-tools.js";
import { assessHardshipSchema } from "../../../../lib/hardship-validation.js";
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/hardship-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json();
  const { message, language } = body;

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
  const history = await getMessageHistory(session.id, "stage1");
  const userContent = buildFollowUpUserContent(history, message);
  const messages = [...history, { role: "user", content: userContent }];

  const client = getAnthropicClient();
  let response;
  try {
    response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildHardshipAssessmentSystemPrompt(language),
      tools: [ASSESS_HARDSHIP_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
  } catch (error) {
    console.error("hardship/assess Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["assess_hardship"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const parsed = assessHardshipSchema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("hardship/assess tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage1", [
    { role: "user", content: userContent },
    { role: "assistant", content: response.content },
  ]);
  await saveArtifact(session.id, "stage1", "hardship_assessment", parsed.data);
  await updateSessionStatus(session.id, { stage1Status: "assessed" });

  return Response.json({ type: "assess_hardship", data: parsed.data });
}
