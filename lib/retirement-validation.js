import { z } from "zod";
import { computeRetirementFinancials } from "./retirement-finance.js";

// Mirrors lib/home-validation.js's shape-validation approach: the model
// supplies ONLY `target_monthly_income`; every CPF projection, Retirement
// Sum reference, and CPF LIFE payout figure is computed by
// lib/retirement-finance.js — real CPF Board formulas, not something an LLM
// should be trusted to compute. Because that computation needs the
// customer's age/CPF context (which isn't part of the model's output),
// these schemas are factory functions that close over that context rather
// than static exports.

const LIFESTYLE_CATEGORIES = ["local_modest", "local_comfortable", "global_travel", "custom"];
const CPF_LIFE_PLANS = ["standard", "basic", "escalating"];

function planFieldsSchema() {
  return {
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    lifestyle_category: z.enum(LIFESTYLE_CATEGORIES),
    target_monthly_income: z.number().min(0),
    estimate_basis: z.string().min(1),
    cpf_life_plan: z.enum(CPF_LIFE_PLANS),
    payout_age: z.number().min(65).max(70),
    assumptions_note: z.string().min(1),
  };
}

function attachFinancials(plan, financialContext) {
  const financials = computeRetirementFinancials({
    targetMonthlyIncome: plan.target_monthly_income,
    cpfLifePlan: plan.cpf_life_plan,
    payoutAge: plan.payout_age,
    ...financialContext,
  });
  return { ...plan, ...financials };
}

export function buildProposeRetirementPlansSchema(financialContext) {
  const plan = z.object(planFieldsSchema()).transform((p) => attachFinancials(p, financialContext));
  return z.object({
    plans: z.array(plan).min(2).max(3),
    research_notes: z.string(),
  });
}

export function buildConfirmRetirementPlanSchema(financialContext) {
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
    "srs_account",
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

export const proposeRetirementSavingsPlanSchema = z.object({
  strategies: z.array(strategy).min(1).max(3),
});

export const finalizeRetirementSavingsPlanSchema = z
  .object({
    strategy_id: z.string().min(1),
    monthly_contribution: z.number().min(0),
    allocation: z.array(allocationEntry).min(1),
    start_month: z.string().min(1),
    target_complete_month: z.string().min(1),
    notes: z.string(),
  })
  .transform((plan) => ({ ...plan, monthly_contribution: allocationSum(plan.allocation) }));
