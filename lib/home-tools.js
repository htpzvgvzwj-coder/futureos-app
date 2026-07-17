// Raw JSON Schema tool definitions sent to the Claude API. Mirrors
// lib/wedding-tools.js's structure. Unlike wedding, the AI here supplies
// ONLY `estimated_price` per plan — every other financial figure (BSD,
// ABSD, loan amount, monthly installment, affordability) is computed
// server-side in lib/home-finance.js from that price and appended during
// validation (lib/home-validation.js), never trusted from the model.

const timelineItemSchema = {
  type: "object",
  properties: {
    activity_id: { type: "string" },
    label: { type: "string" },
    start_offset_months: { type: "number", description: "Months from today until this milestone" },
    duration_months: { type: "number" },
    notes: { type: "string" },
  },
  required: ["activity_id", "label", "start_offset_months", "duration_months", "notes"],
  additionalProperties: false,
};

const planSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    property_type: {
      type: "string",
      enum: ["hdb_new", "hdb_resale", "ec_new", "ec_resale", "condo", "landed"],
    },
    district: { type: "string", description: "e.g. 'Punggol', 'Queenstown', 'District 15'" },
    resale_or_new: { type: "string", enum: ["new", "resale"] },
    unit_type: { type: "string", description: "e.g. '4-room flat', '2-bedroom condo', ~sqft if relevant" },
    estimated_price: { type: "number", description: "Estimated total property price in SGD, grounded in current market research" },
    estimate_basis: { type: "string", description: "What informed this price estimate (recent transactions, HDB resale portal ranges, etc.)" },
    eligibility_notes: { type: "string", description: "BTO wait time, MOP, EIP quota, applicable HDB grants — narrative, not numbers" },
    timeline: { type: "array", items: timelineItemSchema },
  },
  required: [
    "id",
    "name",
    "summary",
    "property_type",
    "district",
    "resale_or_new",
    "unit_type",
    "estimated_price",
    "estimate_basis",
    "eligibility_notes",
    "timeline",
  ],
  additionalProperties: false,
};

// max_uses bounds worst-case latency — carried over from the lesson learned
// in the wedding module, applied here from day one instead of after the fact.
// Measured against a live curl test: max_uses:3 + 3 detailed plans still took
// ~124s, well past Vercel Hobby's 60s maxDuration. Trimmed to 2 searches.
export const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 2 };

export const PROPOSE_HOME_PLANS_TOOL = {
  name: "propose_home_plans",
  description:
    "Present 2-3 distinct property options to the customer for comparison, each grounded in current Singapore market pricing research. Do NOT compute down payment, loan amount, monthly installment, or stamp duty — the app computes those from your estimated_price using official formulas.",
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

export const CONFIRM_HOME_PLAN_TOOL = {
  name: "confirm_home_plan",
  description:
    "Call this ONLY when the customer has unambiguously confirmed one specific property option as final. Carries the final property details that will be persisted and handed off to the savings-plan stage.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plan_id: { type: "string" },
      property_type: {
        type: "string",
        enum: ["hdb_new", "hdb_resale", "ec_new", "ec_resale", "condo", "landed"],
      },
      district: { type: "string" },
      resale_or_new: { type: "string", enum: ["new", "resale"] },
      unit_type: { type: "string" },
      estimated_price: { type: "number" },
      estimate_basis: { type: "string" },
      eligibility_notes: { type: "string" },
      timeline: { type: "array", items: timelineItemSchema },
      confirmation_note: { type: "string" },
    },
    required: [
      "plan_id",
      "property_type",
      "district",
      "resale_or_new",
      "unit_type",
      "estimated_price",
      "estimate_basis",
      "eligibility_notes",
      "timeline",
      "confirmation_note",
    ],
    additionalProperties: false,
  },
};

const allocationEntrySchema = {
  type: "object",
  properties: {
    vehicle: {
      type: "string",
      enum: ["savings_account", "goal_based_deposit", "robo_invest_conservative", "existing_savings_drawdown", "cpf_ordinary_account"],
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

export const PROPOSE_HOME_SAVINGS_PLAN_TOOL = {
  name: "propose_home_savings_plan",
  description:
    "Present distinct savings-strategy options for funding the confirmed property's down payment, tailored to the customer's real income/expenses/savings. Scope strictly to this home-purchase goal only.",
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

export const FINALIZE_HOME_SAVINGS_PLAN_TOOL = {
  name: "finalize_home_savings_plan",
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
