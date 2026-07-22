import { getMessageHistory, getOrCreateSession } from "../../../../lib/hardship-store.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const TOOL_SUMMARIES = {
  assess_hardship: (input) => `Classified hardship: ${input.hardship_type} (${input.expected_duration}).`,
  propose_recovery_actions: (input) => `Presented ${input.actions?.length ?? 0} recovery action(s).`,
};

function summarizeAssistantContent(content) {
  const text = content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (text) return text;
  const toolUse = content.findLast((block) => block.type === "tool_use");
  if (!toolUse) return null;
  return TOOL_SUMMARIES[toolUse.name]?.(toolUse.input) ?? null;
}

function summarizeUserContent(content) {
  const text = content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  return text || null;
}

function formatStage(stage, messages) {
  return messages
    .map((message) => ({
      stage,
      role: message.role,
      text: message.role === "user" ? summarizeUserContent(message.content) : summarizeAssistantContent(message.content),
    }))
    .filter((entry) => entry.text);
}

export async function GET(request) {
  const resolved = await resolveEffectiveProfileKey(request, "hardship");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const session = await getOrCreateSession(resolved.profileKey);
  const [stage1, stage2] = await Promise.all([
    getMessageHistory(session.id, "stage1"),
    getMessageHistory(session.id, "stage2"),
  ]);
  return Response.json({
    entries: [...formatStage("stage1", stage1), ...formatStage("stage2", stage2)],
  });
}
