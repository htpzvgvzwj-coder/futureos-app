// Raw JSON Schema tool definitions sent to the Claude API. These are what
// constrain the model's output shape (strict: true => the API guarantees the
// input validates against the schema exactly). Business-invariant checks
// (totals matching line items, non-negative numbers, etc.) live separately
// in lib/wedding-validation.js since JSON Schema alone can't express them.

const lineItemSchema = {
  type: "object",
  properties: {
    category: { type: "string", description: "e.g. venue, catering, photography, attire, activities, misc" },
    label: { type: "string" },
    unit_rate: { type: "number" },
    unit: { type: "string", description: "e.g. 'per guest', 'flat fee', 'per hour'" },
    quantity: { type: "number" },
    subtotal: { type: "number" },
    estimate_basis: { type: "string", description: "What informed this number (market research, typical range, etc.)" },
  },
  required: ["category", "label", "unit_rate", "unit", "quantity", "subtotal", "estimate_basis"],
  additionalProperties: false,
};

const timelineItemSchema = {
  type: "object",
  properties: {
    activity_id: { type: "string" },
    label: { type: "string" },
    start_offset_minutes: { type: "number", description: "Minutes from the start of the wedding day" },
    duration_minutes: { type: "number" },
    notes: { type: "string" },
  },
  required: ["activity_id", "label", "start_offset_minutes", "duration_minutes", "notes"],
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
    guest_count: { type: "number" },
    venue_tier: { type: "string" },
    line_items: { type: "array", items: lineItemSchema },
    timeline: { type: "array", items: timelineItemSchema },
  },
  required: ["id", "name", "summary", "total_cost", "currency", "guest_count", "venue_tier", "line_items", "timeline"],
  additionalProperties: false,
};

// max_uses bounds worst-case latency — without a cap the model can run many
// search rounds before finalizing, which is what pushed some generations
// past 2 minutes in testing (close to Vercel's function duration limit).
export const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 3 };

export const PROPOSE_PLANS_TOOL = {
  name: "propose_plans",
  description:
    "Present 2-3 distinct complete wedding plan options to the customer for comparison, each with an itemized, market-grounded cost breakdown and a day-of activity timeline.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plans: { type: "array", items: planSchema },
      research_notes: { type: "string", description: "General notes on the market research behind these estimates." },
    },
    required: ["plans", "research_notes"],
    additionalProperties: false,
  },
};

export const CONFIRM_WEDDING_BUDGET_TOOL = {
  name: "confirm_wedding_budget",
  description:
    "Call this ONLY when the customer has unambiguously confirmed one specific final plan. Carries the final itemized budget, activities, and timeline that will be persisted and handed off to the savings-plan stage.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plan_id: { type: "string" },
      wedding_date: { type: "string", description: "ISO date, e.g. 2027-06-15" },
      total_budget: { type: "number" },
      currency: { type: "string" },
      guest_count: { type: "number" },
      line_items: { type: "array", items: lineItemSchema },
      timeline: { type: "array", items: timelineItemSchema },
      confirmation_note: { type: "string" },
    },
    required: ["plan_id", "wedding_date", "total_budget", "currency", "guest_count", "line_items", "timeline", "confirmation_note"],
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
  description:
    "Present distinct savings-strategy options for funding the confirmed wedding budget, tailored to the customer's real income/expenses/savings. Scope strictly to this wedding goal only.",
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
