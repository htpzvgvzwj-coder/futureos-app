import { DEFAULT_PROFILE_KEY, getAllArtifacts, getMessageHistory, getOrCreateSession } from "../../../../lib/investment-store.js";

export const runtime = "nodejs";

const TOOL_SUMMARIES = {
  propose_investment_narrative: (input) => `Explained ${input.narratives?.length ?? 0} shortlisted instrument(s).`,
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

export async function GET() {
  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
  const [stage1, confirmedPicks] = await Promise.all([
    getMessageHistory(session.id, "stage1"),
    getAllArtifacts(session.id, "stage1", "confirmed_investment_pick"),
  ]);
  return Response.json({
    entries: formatStage("stage1", stage1),
    confirmedPicks,
  });
}
