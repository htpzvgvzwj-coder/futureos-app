import { getLatestArtifact, getMessageHistory, getOrCreateSession } from "../../../../lib/loan-store.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const VALID_PURPOSES = new Set(["home", "renovation", "personal"]);

const TOOL_SUMMARIES = {
  propose_loan_sizing: (input) => `Presented ${input.sizing_options?.length ?? 0} loan sizing option(s).`,
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
  const resolved = await resolveEffectiveProfileKey(request, "loan");
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });

  const { searchParams } = new URL(request.url);
  const purpose = searchParams.get("purpose");
  if (!VALID_PURPOSES.has(purpose)) {
    return Response.json({ error: "invalid_purpose" }, { status: 400 });
  }

  const session = await getOrCreateSession(resolved.profileKey, purpose);
  const [stage1, confirmedLoan] = await Promise.all([
    getMessageHistory(session.id, "stage1"),
    getLatestArtifact(session.id, "stage1", "confirmed_loan"),
  ]);
  return Response.json({
    entries: formatStage("stage1", stage1),
    confirmedLoan,
  });
}
