import { z } from "zod";
import { computeHomeFinancials } from "./home-finance.js";

// Mirrors lib/wedding-validation.js's shape-validation approach, but with a
// bigger structural difference: wedding recomputes totals from the model's
// own line items (both numbers came from the model). Here the model
// supplies ONLY `estimated_price`; every financial figure (BSD, ABSD, loan,
// installment, affordability) is computed by lib/home-finance.js — real
// regulatory formulas, not something an LLM should be trusted to compute.
// Because that computation needs the buyer's financial context (income,
// expenses, citizenship status) which isn't part of the model's output,
// these schemas are factory functions that close over that context rather
// than static exports.

const timelineItem = z.object({
  activity_id: z.string().min(1),
  label: z.string().min(1),
  start_offset_months: z.number(),
  duration_months: z.number().min(0),
  notes: z.string(),
});

const PROPERTY_TYPES = ["hdb_new", "hdb_resale", "ec_new", "ec_resale", "condo", "landed"];

function planFieldsSchema() {
  return {
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    property_type: z.enum(PROPERTY_TYPES),
    district: z.string().min(1),
    resale_or_new: z.enum(["new", "resale"]),
    unit_type: z.string().min(1),
    estimated_price: z.number().min(0),
    estimate_basis: z.string().min(1),
    eligibility_notes: z.string().min(1),
    timeline: z.array(timelineItem),
  };
}

function attachFinancials(plan, financialContext) {
  const financials = computeHomeFinancials({
    price: plan.estimated_price,
    propertyType: plan.property_type,
    ...financialContext,
  });
  return { ...plan, ...financials };
}

export function buildProposeHomePlansSchema(financialContext) {
  const plan = z.object(planFieldsSchema()).transform((p) => attachFinancials(p, financialContext));
  return z.object({
    plans: z.array(plan).min(2).max(3),
    research_notes: z.string(),
  });
}

export function buildConfirmHomePlanSchema(financialContext) {
  const { id: _id, name: _name, summary: _summary, ...confirmFields } = planFieldsSchema();
  return z
    .object({
      plan_id: z.string().min(1),
      ...confirmFields,
      confirmation_note: z.string(),
    })
    .transform((p) => attachFinancials(p, financialContext));
}

const allocationEntry = z.object({
  vehicle: z.enum([
    "savings_account",
    "goal_based_deposit",
    "robo_invest_conservative",
    "existing_savings_drawdown",
    "cpf_ordinary_account",
  ]),
  monthly_amount: z.number().min(0),
  rationale: z.string().min(1),
  product_ref: z.string(),
  risk_note: z.string(),
});

const suitability = z.object({
  goal_supported: z.string().min(1),
  data_used: z.string().min(1),
  reason: z.string().min(1),
  risk: z.string(),
  alternative_considered: z.string(),
  limitation: z.string(),
  human_review_required: z.boolean(),
});

function allocationSum(allocation) {
  return Math.round(allocation.reduce((total, entry) => total + entry.monthly_amount, 0) * 100) / 100;
}

const strategy = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    monthly_contribution: z.number().min(0),
    allocation: z.array(allocationEntry).min(1),
    projected_timeline: z.array(z.object({ month: z.string(), cumulative_saved: z.number().min(0) })),
    suitability,
  })
  .transform((s) => ({ ...s, monthly_contribution: allocationSum(s.allocation) }));

export const proposeHomeSavingsPlanSchema = z.object({
  strategies: z.array(strategy).min(1).max(3),
});

export const finalizeHomeSavingsPlanSchema = z
  .object({
    strategy_id: z.string().min(1),
    monthly_contribution: z.number().min(0),
    allocation: z.array(allocationEntry).min(1),
    start_month: z.string().min(1),
    target_complete_month: z.string().min(1),
    notes: z.string(),
  })
  .transform((plan) => ({ ...plan, monthly_contribution: allocationSum(plan.allocation) }));
