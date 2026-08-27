import { runToolTurnWithFallback } from "./ai-fallback.js";
import { buildMirrorDebateSystemPrompt } from "./mirror-prompts.js";
import { FUTURE_MIRROR_DEBATE_TOOL } from "./mirror-tools.js";
import { mirrorDebateSchema } from "./mirror-validation.js";
import { computeGoalFeasibility, DIRECT_MONTHLY_FIELDS, LUMP_SUM_FIELDS } from "./mirror-finance.js";
import { saveDebate, getMirrorHistoryContext } from "./mirror-store.js";
import { listAssets } from "./asset-store.js";
import { computeInsuranceCoverage } from "./asset-finance.js";
import { resolveAvailableLiquidSavings } from "./liquid-savings-context.js";
import { getCrossGoalSnapshot, computeWholePictureImpact } from "./cross-goal-context.js";
import { getJointPartnerId, getPartnerFeasibilityView } from "./joint-debate-context.js";
import { getUserById } from "./auth.js";
import { createAlert } from "./guardian-alert-store.js";
import { computeActivityCheck } from "./activity-check-finance.js";
import { computeFutureComparison } from "./future-comparison-finance.js";
import { computeShadowAccount } from "./shadow-account-finance.js";
import { getTypicalSavingsRatePercent } from "./peer-benchmark.js";
import { getIncomeHistory } from "./income-store.js";

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

    // Real Asset Profile ledger context (lib/asset-store.js), same as the
    // standalone debate form (app/api/mirror/debate/route.js) - "flexible"
    // horizon since this is exploratory analysis, not a money-committing
    // action.
    const assets = await listAssets(userId);
    const assetContext = {
      availableLiquidSavings: await resolveAvailableLiquidSavings(userId, inputs.currentSavings, "flexible"),
      hasActiveInsurance: computeInsuranceCoverage(assets).hasActiveInsurance,
    };

    const computed = computeGoalFeasibility(goalType, inputs, assetContext);
    // Same honesty-audit fix as the standalone debate form - see
    // app/api/mirror/debate/route.js.
    computed.liquidSavingsSourcedFromLedger = assets.length > 0;

    // Whole-picture context - same as the standalone debate form. See
    // lib/cross-goal-context.js.
    const crossGoalSnapshot = await getCrossGoalSnapshot(userId);
    computed.wholePicture = computeWholePictureImpact(computed, crossGoalSnapshot);

    const goalLabel = GOAL_LABELS[goalType] ?? goalType;

    // Same self-referencing history context the standalone debate form uses
    // (app/api/mirror/debate/route.js) - see lib/mirror-store.js's
    // getMirrorHistoryContext.
    const history = await getMirrorHistoryContext(userId);

    // Real joint-partner context - same as the standalone debate form. See
    // lib/joint-debate-context.js.
    const jointPartnerId = await getJointPartnerId(userId, goalType);
    const partnerComputed = jointPartnerId ? await getPartnerFeasibilityView(jointPartnerId, goalType, inputs) : null;

    let result;
    try {
      result = await runToolTurnWithFallback({
        systemPrompt: buildMirrorDebateSystemPrompt(language, {
          situation,
          goalLabel,
          computed,
          isIncomeIrregular: inputs.isIncomeIrregular,
          incomeSampleSize: inputs.incomeSampleSize,
          history,
          partnerComputed,
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
      context: { inputs, computed, goalLabel, language, history, partnerComputed },
      aiProvider: result.provider,
      partnerId: jointPartnerId,
      ...parsed.data,
    });

    // Real second side of a joint debate - same as the standalone debate
    // form. See app/api/mirror/debate/route.js.
    if (jointPartnerId) {
      try {
        const initiator = await getUserById(userId);
        await createAlert(jointPartnerId, {
          alertType: "joint_debate_pending",
          domain: goalType,
          severity: "monitoring",
          detail: { debateId: saved.id, goalType, goalLabel, initiatorDisplayName: initiator?.display_name ?? null },
        });
      } catch (error) {
        console.error("mirror chat run_debate: failed to create joint_debate_pending alert for partner (non-fatal)", error);
      }
    }

    return {
      ok: true,
      debateId: saved.id,
      goalType,
      goalLabel,
      futureScore: computed.feasibilityScore,
      riskLevel: computed.riskLevel,
      computed,
      aiProvider: result.provider,
      history,
      partnerComputed,
      jointPartnerId,
      ...parsed.data,
    };
  };
}

// The three tools below are deliberately stateless (no write to
// activity_checks/future_comparisons/shadow_account tables - none of
// those even exist for future comparison beyond what's already there) -
// unlike run_debate, there is no separate narration AI call either: the
// real computed result is fed back as a genuine tool_result, and the
// chat's own next reply narrates it directly in conversation, in its own
// voice for that specific question, rather than a second AI call
// producing a copy of the standalone screen's fixed verdict-card text.
// This is also why the standalone screens remain separately useful - they
// persist history (Future Comparison) or need no chat context at all
// (Activity Check, Shadow Account); the chat tools are for "let's just
// check this real quick without leaving the conversation."

export const CHECK_ACTIVITY_TOOL = {
  name: "check_activity",
  description:
    "Check whether a specific amount is unusual for this customer, compared against their own real confirmed history (loans/investments/savings on file) - not a fraud model, just their own real numbers. Call this when the customer describes a transaction or decision and wants to know if it's normal for them.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      amount: { type: "number" },
      description: { type: "string", description: "A short restatement of what this amount is for." },
    },
    required: ["amount", "description"],
    additionalProperties: false,
  },
};

export function createCheckActivityExecutor({ userId, baseInputs }) {
  return async function checkActivityExecutor({ amount }) {
    const check = await computeActivityCheck(userId, { amount, monthlyIncome: baseInputs.monthlyIncome });
    return { ok: true, check };
  };
}

export const COMPARE_FUTURES_TOOL = {
  name: "compare_futures",
  description:
    "Compare two real financial futures for this customer - committing to something now (a purchase, a new recurring cost) versus waiting. Call this when the customer is deciding whether to spend/commit now or hold off.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      amount: { type: "number", description: "The one-time cost, 0 if none." },
      recurringMonthly: { type: "number", description: "The new ongoing monthly cost, 0 if none." },
      horizonMonths: { type: "number", description: "How many months ahead to compare, e.g. 12." },
      description: { type: "string" },
    },
    required: ["amount", "recurringMonthly", "horizonMonths", "description"],
    additionalProperties: false,
  },
};

export function createCompareFuturesExecutor({ userId, baseInputs }) {
  return async function compareFuturesExecutor({ amount, recurringMonthly, horizonMonths }) {
    // Same server-truth audited savings figure the standalone route uses
    // (lib/liquid-savings-context.js) rather than trusting baseInputs'
    // raw currentSavings - "flexible" horizon since this is exploratory.
    const realCurrentSavings = await resolveAvailableLiquidSavings(userId, baseInputs.currentSavings, "flexible");
    const numbers = await computeFutureComparison(userId, {
      amount,
      recurringMonthly,
      horizonMonths,
      monthlyIncome: baseInputs.monthlyIncome,
      monthlyExpenses: baseInputs.monthlyExpenses,
      currentSavings: realCurrentSavings,
    });
    return { ok: true, numbers };
  };
}

export const CHECK_SHADOW_ACCOUNT_TOOL = {
  name: "check_shadow_account",
  description:
    "Check what the customer's real logged income history would have become at a typical savings-rate guideline, versus their real actual savings. Call this when the customer asks how their real saving habits compare to a realistic benchmark.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      note: { type: "string", description: "A short restatement of why you're checking this." },
    },
    required: ["note"],
    additionalProperties: false,
  },
};

export function createCheckShadowAccountExecutor({ userId, baseInputs }) {
  return async function checkShadowAccountExecutor() {
    const incomeHistory = await getIncomeHistory(userId);
    const guidelineRatePercent = getTypicalSavingsRatePercent(baseInputs.monthlyIncome);
    const result = computeShadowAccount(incomeHistory, { currentSavings: baseInputs.currentSavings, guidelineRatePercent });
    return { ok: true, result };
  };
}

// Not a real computation - a structured navigation signal. The chat can
// talk through plenty on its own, but some real tools in this app (Family
// CFO's member view, Family Travel's full itinerary flow, Deal Finder's
// live web search) are genuinely screen-shaped experiences, not a single
// number to report back mid-conversation. This is how the chat can
// actually take the customer there instead of just describing that the
// screen exists.
const OPENABLE_SCREENS = new Set([
  "familyCfo",
  "goalMarketplace",
  "personalEconomy",
  "dealFinder",
  "smeCashflow",
  "familyTravel",
  "shadowAccount",
  "activityCheck",
  "futureComparison",
  "assetProfile",
  "strategicBalance",
]);

export const OPEN_SCREEN_TOOL = {
  name: "open_screen",
  description:
    "Offer to take the customer directly to a specific real screen when that's genuinely the best next step - e.g. they want to browse full trip options, manage family access, run a real web price search, or see their full asset ledger. Always call this alongside real spoken text explaining why in the same turn, never as a bare action with no explanation.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      screen: { type: "string", enum: Array.from(OPENABLE_SCREENS) },
      reason: { type: "string", description: "One short sentence on why this screen is the right next step." },
    },
    required: ["screen", "reason"],
    additionalProperties: false,
  },
};

export function createOpenScreenExecutor() {
  return async function openScreenExecutor({ screen, reason }) {
    if (!OPENABLE_SCREENS.has(screen)) return { ok: false, error: "unknown_screen" };
    return { ok: true, screen, reason };
  };
}
