import { z } from "zod";

// Mirrors lib/wedding-validation.js's pattern: line_items are the source of truth (each carries
// its own estimate_basis) and totals are recomputed server-side from their sum, so every displayed
// number stays traceable to an itemized breakdown. Unlike Wedding, there are no deterministic
// server-computed categories here (no venue/photography/attire equivalent) - every line item is
// the model's own web-search-grounded estimate.

const lineItem = z.object({
  category: z.string().min(1),
  label: z.string().min(1),
  unit_rate: z.number().min(0),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  subtotal: z.number().min(0),
  estimate_basis: z.string().min(1),
});

function lineItemsSum(lineItems) {
  return Math.round(lineItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
}

const plan = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    total_cost: z.number().min(0),
    currency: z.string().min(1),
    target_date: z.string().min(1),
    line_items: z.array(lineItem).min(1),
  })
  .transform((plan) => ({ ...plan, total_cost: lineItemsSum(plan.line_items) }));

export const proposePlansSchema = z.object({
  plans: z.array(plan).min(2).max(3),
  research_notes: z.string(),
});

export const confirmGoalPlanSchema = z
  .object({
    plan_id: z.string().min(1),
    goal_name: z.string().min(1),
    target_date: z.string().min(1),
    total_budget: z.number().min(0),
    currency: z.string().min(1),
    line_items: z.array(lineItem).min(1),
    confirmation_note: z.string(),
  })
  .transform((budget) => ({ ...budget, total_budget: lineItemsSum(budget.line_items) }));

const allocationEntry = z.object({
  vehicle: z.enum(["savings_account", "goal_based_deposit", "robo_invest_conservative", "existing_savings_drawdown"]),
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

export const proposeSavingsPlanSchema = z.object({
  strategies: z.array(strategy).min(1).max(3),
});

export const finalizeSavingsPlanSchema = z
  .object({
    strategy_id: z.string().min(1),
    monthly_contribution: z.number().min(0),
    allocation: z.array(allocationEntry).min(1),
    start_month: z.string().min(1),
    target_complete_month: z.string().min(1),
    notes: z.string(),
  })
  .transform((plan) => ({ ...plan, monthly_contribution: allocationSum(plan.allocation) }));
