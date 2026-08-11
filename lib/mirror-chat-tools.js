import { runToolTurnWithFallback } from "./ai-fallback.js";
import { buildMirrorDebateSystemPrompt } from "./mirror-prompts.js";
import { FUTURE_MIRROR_DEBATE_TOOL } from "./mirror-tools.js";
import { mirrorDebateSchema } from "./mirror-validation.js";
import { computeGoalFeasibility, DIRECT_MONTHLY_FIELDS, LUMP_SUM_FIELDS } from "./mirror-finance.js";
import { saveDebate } from "./mirror-store.js";

// This tool is NOT a new debate engine - its executor is the exact same
// pipeline app/api/mirror/debate/route.js already uses (computeGoalFeasibility
// -> the real anthropic->groq->gemini fallback -> saveDebate into the same
// mirror_debates table). A debate triggered from chat gets the same
// accountability tracking (lib/mirror-outcome-resolver.js), the same
// escalation mechanism, and the same persisted context trace as one run
// from the standalone form. Chat is a new INTERFACE onto this, not a
// parallel implementation.
export const RUN_DEBATE_TOOL = {
  name: "run_debate",
  description:
    "Run a real Bull/Bear/Judge financial feasibility debate on a specific goal, computed from the customer's real financial data already on file. Call this when the customer wants an actual assessment of a specific plan, not for general conversation. Only set overrideAmount/overrideDate if the customer explicitly stated a different target than what's already on file - otherwise leave them null and the real figures already on file are used.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      goalType: {
        type: "string",
        enum: ["wedding", "home", "retirement", "investment", "family", "business", "custom", "car"],
      },
      situation: {
        type: "string",
        description: "A concise restatement of what the customer is considering, in their own words - this appears in the debate as their stated situation.",
      },
      overrideAmount: {
        type: ["number", "null"],
        description: "Only if the customer explicitly stated a different target amount/monthly figure in this conversation than what's on file; otherwise null.",
      },
      overrideDate: {
        type: ["string", "null"],
        description: "Only if the customer explicitly stated a different target date (YYYY-MM) in this conversation than what's on file; otherwise null.",
      },
    },
    required: ["goalType", "situation", "overrideAmount", "overrideDate"],
    additionalProperties: false,
  },
};

// No server-side i18n system exists (goal labels are normally translated
// client-side via t() - see getGoalLabel in app/page.jsx) - this is a
// deliberately minor, English-only fallback for the debate prompt's label
// text. It doesn't affect the real computed numbers, only cosmetic label
// text inside the prompt.
const GOAL_LABELS = {
  wedding: "the wedding",
  home: "the home purchase",
  retirement: "retirement",
  investment: "the investment plan",
  family: "the family plan",
  business: "the business",
  custom: "this goal",
  car: "the car purchase",
};

// `baseInputs` is the customer's real profile-derived figures (monthlyIncome,
// monthlyExpenses, isIncomeIrregular, incomeSampleSize, and every goal's
// pre-set target/date fields) - the exact same shape the standalone Mirror
// form already sends as `inputs`, captured here via closure from the chat
// route's request body rather than trusted from the model.
export function createRunDebateExecutor({ userId, language, baseInputs }) {
  return async function runDebateExecutor({ goalType, situation, overrideAmount, overrideDate }) {
    const fieldConfig = DIRECT_MONTHLY_FIELDS[goalType]
      ? { amountField: DIRECT_MONTHLY_FIELDS[goalType], dateField: null }
      : {
          amountField: (LUMP_SUM_FIELDS[goalType] ?? LUMP_SUM_FIELDS.custom).amount,
          dateField: (LUMP_SUM_FIELDS[goalType] ?? LUMP_SUM_FIELDS.custom).date,
        };

    const inputs = {
      ...baseInputs,
      ...(overrideAmount != null ? { [fieldConfig.amountField]: overrideAmount } : {}),
      ...(overrideDate != null && fieldConfig.dateField ? { [fieldConfig.dateField]: overrideDate } : {}),
    };

    const computed = computeGoalFeasibility(goalType, inputs);
    const goalLabel = GOAL_LABELS[goalType] ?? goalType;

    let result;
    try {
      result = await runToolTurnWithFallback({
        systemPrompt: buildMirrorDebateSystemPrompt(language, {
          situation,
          goalLabel,
          computed,
          isIncomeIrregular: inputs.isIncomeIrregular,
          incomeSampleSize: inputs.incomeSampleSize,
        }),
        tool: FUTURE_MIRROR_DEBATE_TOOL,
        userMessage: "Run the Bull/Bear/Judge debate on this plan.",
      });
    } catch {
      return { ok: false, error: "upstream_error" };
    }

    if (result.refusal) {
      return { ok: false, error: "refusal" };
    }
    if (!result.toolInput) {
      return { ok: false, error: "inconclusive" };
    }

    const parsed = mirrorDebateSchema.safeParse(result.toolInput);
    if (!parsed.success) {
      return { ok: false, error: "validation_failed" };
    }

    const saved = await saveDebate(userId, {
      goalType,
      situation,
      futureScore: computed.feasibilityScore,
      riskLevel: computed.riskLevel,
      context: { inputs, computed, goalLabel, language },
      aiProvider: result.provider,
      ...parsed.data,
    });

    return {
      ok: true,
      debateId: saved.id,
      goalType,
      goalLabel,
      futureScore: computed.feasibilityScore,
      riskLevel: computed.riskLevel,
      computed,
      aiProvider: result.provider,
      ...parsed.data,
    };
  };
}
