import { DEFAULT_PROFILE_KEY, getMessageHistory, getOrCreateSession } from "../../../../lib/home-store.js";

export const runtime = "nodejs";

const TOOL_SUMMARIES = {
  propose_home_plans: (input) => `Presented ${input.plans?.length ?? 0} property plan option(s).`,
  confirm_home_plan: (input) => `Confirmed property plan: ${input.plan_id}.`,
  propose_home_savings_plan: (input) => `Presented ${input.strategies?.length ?? 0} savings strategy option(s).`,
  finalize_home_savings_plan: (input) => `Confirmed savings plan: SGD ${input.monthly_contribution}/month.`,
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
  const [stage1, stage2] = await Promise.all([
    getMessageHistory(session.id, "stage1"),
    getMessageHistory(session.id, "stage2"),
  ]);
  return Response.json({
    entries: [...formatStage("stage1", stage1), ...formatStage("stage2", stage2)],
  });
}
