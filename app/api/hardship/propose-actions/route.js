import {
  buildFollowUpUserContent,
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../../lib/anthropic-client.js";
import { buildHardshipRecoverySystemPrompt } from "../../../../lib/hardship-prompts.js";
import { PROPOSE_RECOVERY_ACTIONS_TOOL } from "../../../../lib/hardship-tools.js";
import { buildProposeRecoveryActionsSchema } from "../../../../lib/hardship-validation.js";
import { getCustomerCommitments, getEmergencyFundSnapshot } from "../../../../lib/hardship-context.js";
import {
  computeCommittedMonthlyOutflow,
  computeIncomeGap,
  computeDefaultDrawdown,
  computeWindfallSplit,
} from "../../../../lib/hardship-finance.js";
import {
  appendMessages,
  DEFAULT_PROFILE_KEY,
  getLatestArtifact,
  getMessageHistory,
  getOrCreateSession,
  saveArtifact,
  updateSessionStatus,
} from "../../../../lib/hardship-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json();
  const { message, language, profile } = body;

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }
  if (!profile) {
    return Response.json({ error: "missing_profile" }, { status: 400 });
  }

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY);
  const assessment = await getLatestArtifact(session.id, "stage1", "hardship_assessment");
  if (!assessment) {
    return Response.json({ error: "no_assessment" }, { status: 409 });
  }

  const commitments = await getCustomerCommitments();
  const { monthlyExpenses, monthlyIncome, currentFund } = getEmergencyFundSnapshot(profile);

  const outflow = computeCommittedMonthlyOutflow(commitments, monthlyExpenses);
  const gap = computeIncomeGap({
    totalCommittedOutflow: outflow.totalCommittedOutflow,
    statedNewMonthlyIncome: assessment.stated_new_monthly_income,
    priorMonthlyIncome: monthlyIncome,
  });
  const defaultDrawdown = computeDefaultDrawdown({ currentFund, monthlyShortfall: gap.monthlyShortfall });
  const windfallSplit = assessment.windfall_mentioned && assessment.stated_windfall_amount
    ? computeWindfallSplit({ statedWindfallAmount: assessment.stated_windfall_amount, monthlyShortfall: gap.monthlyShortfall })
    : null;

  const currentContributionByDomain = Object.fromEntries(
    outflow.perDomain.filter((d) => d.monthly > 0).map((d) => [d.domain, d.monthly])
  );

  const history = await getMessageHistory(session.id, "stage2");
  const userContent = buildFollowUpUserContent(history, message);
  const messages = [...history, { role: "user", content: userContent }];

  const client = getAnthropicClient();
  let response;
  try {
    response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: buildHardshipRecoverySystemPrompt(language, { assessment, computed: { outflow, gap, defaultDrawdown, windfallSplit } }),
      tools: [PROPOSE_RECOVERY_ACTIONS_TOOL],
      tool_choice: { type: "any" },
      messages,
    });
  } catch (error) {
    console.error("hardship/propose-actions Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, ["propose_recovery_actions"]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const schema = buildProposeRecoveryActionsSchema({ currentContributionByDomain, defaultDrawdown, windfallSplit });
  const parsed = schema.safeParse(deepCleanStrayEscapes(toolUse.input));
  if (!parsed.success) {
    console.error("hardship/propose-actions tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  await appendMessages(session.id, "stage2", [
    { role: "user", content: userContent },
    { role: "assistant", content: response.content },
  ]);
  await saveArtifact(session.id, "stage2", "proposed_recovery_actions", parsed.data);
  await updateSessionStatus(session.id, { stage2Status: "proposed" });

  return Response.json({
    type: "propose_recovery_actions",
    data: parsed.data,
    computed: { outflow, gap, defaultDrawdown, windfallSplit },
  });
}
