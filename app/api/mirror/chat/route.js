import { buildFollowUpUserContent, extractText, getAnthropicClient, WEDDING_MODEL } from "../../../../lib/anthropic-client.js";
import { runChatTurnWithTools } from "../../../../lib/chat-tool-loop.js";
import { buildMirrorChatSystemPrompt } from "../../../../lib/mirror-chat-prompts.js";
import { RUN_DEBATE_TOOL, createRunDebateExecutor } from "../../../../lib/mirror-chat-tools.js";
import { appendMessages, getMessageHistory, getOrCreateSession } from "../../../../lib/mirror-chat-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { message, language, baseInputs } = body;

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }
  if (!baseInputs) {
    return Response.json({ error: "missing_profile" }, { status: 400 });
  }

  const session = await getOrCreateSession(userId);
  const history = await getMessageHistory(session.id);
  const userContent = buildFollowUpUserContent(history, message);
  // getMessageHistory's rows carry toolResults/context too (the app's own
  // "why did I say that" persistence, read separately by
  // /api/mirror/chat/history) - the Anthropic API rejects any message with
  // extra top-level keys beyond role/content, so every real second turn in
  // a Mirror conversation was failing with a 400 until this was stripped.
  const apiHistory = history.map(({ role, content }) => ({ role, content }));
  const messages = [...apiHistory, { role: "user", content: userContent }];

  const client = getAnthropicClient();
  let response;
  let toolResults;
  try {
    ({ response, toolResults } = await runChatTurnWithTools(
      client,
      {
        model: WEDDING_MODEL,
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: buildMirrorChatSystemPrompt(language, { baseInputs }),
        tools: [RUN_DEBATE_TOOL],
        tool_choice: { type: "auto" },
        messages,
      },
      { run_debate: createRunDebateExecutor({ userId, language, baseInputs }) }
    ));
  } catch (error) {
    console.error("mirror/chat call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const reply = extractText(response.content);

  // "Why did I say that?" - the real facts this specific reply was
  // generated from, same principle as mirror_debates.context (P1, earlier
  // this session), persisted per chat turn instead of per debate.
  await appendMessages(session.id, [
    { role: "user", content: userContent },
    {
      role: "assistant",
      content: response.content,
      toolResults: toolResults.length ? toolResults : null,
      context: { baseInputs, language },
    },
  ]);

  return Response.json({
    reply,
    debate: toolResults.find((entry) => entry.name === "run_debate" && entry.result?.ok)?.result ?? null,
    context: { baseInputs, language },
  });
}
