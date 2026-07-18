// Raw JSON Schema tool definitions sent to the Claude API. Mirrors
// lib/home-tools.js's structure. The AI supplies ONLY a market-grounded
// `target_monthly_income` per lifestyle option — every CPF projection,
// Retirement Sum reference, and CPF LIFE payout number is computed
// server-side in lib/retirement-finance.js and appended during validation
// (lib/retirement-validation.js), never trusted from the model.

import { WEB_SEARCH_TOOL } from "./home-tools.js";

export { WEB_SEARCH_TOOL };

const planSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    lifestyle_category: {
      type: "string",
      enum: ["local_modest", "local_comfortable", "global_travel", "custom"],
    },
    target_monthly_income: {
      type: "number",
      description: "Estimated monthly retirement income needed in SGD, grounded in current market research on cost of living/travel",
    },
    estimate_basis: { type: "string", description: "What informed this estimate (cost-of-living data, travel budget benchmarks, etc.)" },
    cpf_life_plan: { type: "string", enum: ["standard", "basic", "escalating"] },
    payout_age: { type: "number", description: "CPF LIFE payout start age, 65-70" },
    assumptions_note: { type: "string", description: "Any lifestyle assumptions behind this estimate — narrative, not numbers" },
  },
  required: [
    "id",
    "name",
    "summary",
    "lifestyle_category",
    "target_monthly_income",
    "estimate_basis",
    "cpf_life_plan",
    "payout_age",
    "assumptions_note",
  ],
  additionalProperties: false,
};

export const PROPOSE_RETIREMENT_PLANS_TOOL = {
  name: "propose_retirement_plans",
  description:
    "Present 2-3 distinct retirement lifestyle options to the customer for comparison, each with a market-grounded target monthly income estimate. Do NOT compute CPF balances, Retirement Account projections, CPF LIFE payouts, or any funding gap — the app computes those from your target_monthly_income using real CPF Board formulas.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plans: { type: "array", items: planSchema },
      research_notes: { type: "string", description: "General notes on the cost-of-living/lifestyle research behind these estimates." },
    },
    required: ["plans", "research_notes"],
    additionalProperties: false,
  },
};

export const CONFIRM_RETIREMENT_PLAN_TOOL = {
  name: "confirm_retirement_plan",
  description:
    "Call this ONLY when the customer has unambiguously confirmed one specific retirement lifestyle option as final. Carries the final target income and CPF LIFE preferences that will be persisted and handed off to the savings-plan stage.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plan_id: { type: "string" },
      lifestyle_category: {
        type: "string",
        enum: ["local_modest", "local_comfortable", "global_travel", "custom"],
      },
      target_monthly_income: { type: "number" },
      estimate_basis: { type: "string" },
      cpf_life_plan: { type: "string", enum: ["standard", "basic", "escalating"] },
      payout_age: { type: "number" },
      assumptions_note: { type: "string" },
      confirmation_note: { type: "string" },
    },
    required: [
      "plan_id",
      "lifestyle_category",
      "target_monthly_income",
      "estimate_basis",
      "cpf_life_plan",
      "payout_age",
      "assumptions_note",
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
      enum: [
        "savings_account",
        "goal_based_deposit",
        "robo_invest_conservative",
        "existing_savings_drawdown",
        "cpf_ordinary_account",
        "srs_account",
      ],
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

export const PROPOSE_RETIREMENT_SAVINGS_PLAN_TOOL = {
  name: "propose_retirement_savings_plan",
  description:
    "Present distinct savings/investment strategy options for funding the confirmed retirement plan's monthly income gap (the shortfall between the target lifestyle income and the projected CPF LIFE payout), tailored to the customer's real income/expenses/savings. Scope strictly to this retirement goal only.",
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

export const FINALIZE_RETIREMENT_SAVINGS_PLAN_TOOL = {
  name: "finalize_retirement_savings_plan",
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
