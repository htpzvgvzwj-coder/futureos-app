// Raw JSON Schema tool definitions sent to the Claude API, mirroring lib/wedding-tools.js's
// pattern. Unlike Wedding (which has 3 deterministic server-computed categories - venue,
// photography, attire), "Other" covers an open-ended goal (a trip, a gadget, an event, anything
// that doesn't fit an existing category), so every cost line comes from the model's own
// web-search-grounded estimate - there is nothing to compute server-side.

const lineItemSchema = {
  type: "object",
  properties: {
    category: { type: "string", description: "e.g. flights, accommodation, gear, tuition, deposit - whatever categories genuinely apply to this goal" },
    label: { type: "string" },
    unit_rate: { type: "number" },
    unit: { type: "string", description: "e.g. 'per person', 'flat fee', 'per night'" },
    quantity: { type: "number" },
    subtotal: { type: "number" },
    estimate_basis: { type: "string", description: "What informed this number (market research, typical range, etc.)" },
  },
  required: ["category", "label", "unit_rate", "unit", "quantity", "subtotal", "estimate_basis"],
  additionalProperties: false,
};

const planSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    total_cost: { type: "number" },
    currency: { type: "string" },
    target_date: { type: "string", description: "ISO date the goal is targeted for, e.g. 2027-06-15 - a reasonable estimate if the customer didn't specify one" },
    line_items: { type: "array", items: lineItemSchema },
  },
  required: ["id", "name", "summary", "total_cost", "currency", "target_date", "line_items"],
  additionalProperties: false,
};

export const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 3 };

export const PROPOSE_PLANS_TOOL = {
  name: "propose_plans",
  description: "Present 2-3 distinct complete plan options for the customer's goal, each with an itemized, web-search-grounded cost breakdown.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plans: { type: "array", items: planSchema },
      research_notes: { type: "string", description: "General notes on the market research behind the estimates and any assumptions made about an underspecified goal." },
    },
    required: ["plans", "research_notes"],
    additionalProperties: false,
  },
};

export const CONFIRM_GOAL_PLAN_TOOL = {
  name: "confirm_goal_plan",
  description: "Call this ONLY when the customer has unambiguously confirmed one specific final plan. Carries the final itemized budget that will be persisted and handed off to the savings-plan stage.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plan_id: { type: "string" },
      goal_name: { type: "string" },
      target_date: { type: "string", description: "ISO date, e.g. 2027-06-15" },
      total_budget: { type: "number" },
      currency: { type: "string" },
      line_items: { type: "array", items: lineItemSchema },
      confirmation_note: { type: "string" },
    },
    required: ["plan_id", "goal_name", "target_date", "total_budget", "currency", "line_items", "confirmation_note"],
    additionalProperties: false,
  },
};

const allocationEntrySchema = {
  type: "object",
  properties: {
    vehicle: {
      type: "string",
      enum: ["savings_account", "goal_based_deposit", "robo_invest_conservative", "existing_savings_drawdown"],
    },
    monthly_amount: { type: "number" },
    rationale: { type: "string" },
    product_ref: { type: "string" },
    risk_note: { type: "string" },
  },
  required: ["vehicle", "monthly_amount", "rationale", "product_ref", "risk_note"],
  additionalProperties: false,
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

const strategySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    monthly_contribution: { type: "number" },
    allocation: { type: "array", items: allocationEntrySchema },
    projected_timeline: {
      type: "array",
      items: {
        type: "object",
        properties: { month: { type: "string" }, cumulative_saved: { type: "number" } },
        required: ["month", "cumulative_saved"],
        additionalProperties: false,
      },
    },
    suitability: suitabilitySchema,
  },
  required: ["id", "name", "summary", "monthly_contribution", "allocation", "projected_timeline", "suitability"],
  additionalProperties: false,
};

export const PROPOSE_SAVINGS_PLAN_TOOL = {
  name: "propose_savings_plan",
  description: "Present distinct savings-strategy options for funding the confirmed goal, tailored to the customer's real income/expenses/savings. Scope strictly to this goal only.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      strategies: { type: "array", items: strategySchema },
    },
    required: ["strategies"],
    additionalProperties: false,
  },
};

export const FINALIZE_SAVINGS_PLAN_TOOL = {
  name: "finalize_savings_plan",
  description: "Call this ONLY when the customer has confirmed one specific savings strategy.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      strategy_id: { type: "string" },
      monthly_contribution: { type: "number" },
      allocation: { type: "array", items: allocationEntrySchema },
      start_month: { type: "string" },
      target_complete_month: { type: "string" },
      notes: { type: "string" },
    },
    required: ["strategy_id", "monthly_contribution", "allocation", "start_month", "target_complete_month", "notes"],
    additionalProperties: false,
  },
};

export const LANGUAGE_NAMES = {
  en: "English",
  zh: "Simplified Chinese",
  ms: "Bahasa Melayu",
  ta: "Tamil",
};
