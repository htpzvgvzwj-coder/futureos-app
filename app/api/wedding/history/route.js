import { getMessageHistory, getOrCreateSession } from "../../../../lib/wedding-store.js";
import { resolveEffectiveProfileKey } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const TOOL_SUMMARIES = {
  propose_plans: (input) => `Presented ${input.plans?.length ?? 0} wedding plan option(s).`,
  confirm_wedding_budget: (input) => `Confirmed wedding budget: SGD ${input.total_budget} (${input.plan_id}).`,
  propose_savings_plan: (input) => `Presented ${input.strategies?.length ?? 0} savings strategy option(s).`,
  finalize_savings_plan: (input) => `Confirmed savings plan: SGD ${input.monthly_contribution}/month.`,
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
  const resolved = await resolveEffectiveProfileKey(request, "wedding");
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
