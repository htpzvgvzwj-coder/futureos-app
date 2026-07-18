// Raw JSON Schema tool definitions sent to the Claude API. Unlike
// wedding/home/retirement, this is not a propose/confirm pair — stage1 is a
// single classification call (there's nothing to "confirm," the AI just
// extracts what the customer stated), and stage2 proposes a menu of
// concrete recovery actions whose dollar amounts are computed server-side
// (lib/hardship-finance.js) and overwritten during validation
// (lib/hardship-validation.js), never trusted from the model.

export const ASSESS_HARDSHIP_TOOL = {
  name: "assess_hardship",
  description:
    "Classify the customer's described financial hardship. Extract ONLY what the customer explicitly stated - do not estimate or invent any number. Call this exactly once per turn to end it.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      hardship_type: {
        type: "string",
        enum: ["income_reduction", "job_loss", "one_time_expense", "windfall_with_gap", "other"],
      },
      expected_duration: {
        type: "string",
        enum: ["temporary_under_6_months", "temporary_6_to_12_months", "indefinite", "one_time_no_recurrence"],
      },
      stated_new_monthly_income: {
        type: ["number", "null"],
        description: "Only if the customer explicitly stated a new/reduced monthly income figure; otherwise null.",
      },
      windfall_mentioned: { type: "boolean", description: "True if the customer mentioned receiving or expecting a lump sum (severance, insurance payout, etc.)." },
      stated_windfall_amount: {
        type: ["number", "null"],
        description: "Only if the customer explicitly stated a windfall amount; otherwise null.",
      },
      narrative_summary: { type: "string", description: "One or two sentence plain-language summary of the situation, in the customer's language." },
    },
    required: [
      "hardship_type",
      "expected_duration",
      "stated_new_monthly_income",
      "windfall_mentioned",
      "stated_windfall_amount",
      "narrative_summary",
    ],
    additionalProperties: false,
  },
};

const suitabilitySchema = {
  type: "object",
  properties: {
    goal_supported: { type: "string" },
    data_used: { type: "string" },
    reason: { type: "string" },
    risk: { type: "string" },
    alternative_considered: { type: "string" },
    limitation: { type: "string" },
    human_review_required: { type: "boolean" },
  },
  required: ["goal_supported", "data_used", "reason", "risk", "alternative_considered", "limitation", "human_review_required"],
  additionalProperties: false,
};

const recoveryActionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    action_type: {
      type: "string",
      enum: ["pause_goal_plan", "reduce_goal_plan", "drawdown_emergency_fund", "invest_excess", "other_ocbc_support"],
    },
    target_domain: {
      type: ["string", "null"],
      enum: ["wedding", "home", "retirement", null],
      description: "Required for pause_goal_plan/reduce_goal_plan, null otherwise.",
    },
    amount: {
      type: "number",
      description: "Your suggestion for reference only - the app recomputes and overwrites this from real financial data, never trusts this value.",
    },
    rationale: { type: "string" },
    suitability: suitabilitySchema,
  },
  required: ["id", "action_type", "target_domain", "amount", "rationale", "suitability"],
  additionalProperties: false,
};

export const PROPOSE_RECOVERY_ACTIONS_TOOL = {
  name: "propose_recovery_actions",
  description:
    "Present 1-4 concrete recovery actions the bank can take to help the customer through their hardship, using the real financial context already provided in this prompt. Do NOT invent dollar amounts - the app computes and overwrites every amount from real data. invest_excess is only valid if a windfall with money left over after covering the gap was mentioned.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      actions: { type: "array", items: recoveryActionSchema },
      summary_note: { type: "string", description: "A short, empathetic summary of the overall recovery plan." },
    },
    required: ["actions", "summary_note"],
    additionalProperties: false,
  },
};
