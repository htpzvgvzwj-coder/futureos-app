import { z } from "zod";

// Same discipline as decision-validation.js: only categorical/context values are trusted from the
// client (amount, recurringMonthly, horizonMonths, the description) - real income/expenses/savings
// are resolved server-side from the customer's own on-file data (see the route), and every real
// number in the response comes from lib/future-comparison-finance.js, never the AI.
export const futureComparisonRequestSchema = z.object({
  description: z.string().min(1).max(400),
  amount: z.number().min(0),
  recurringMonthly: z.number().min(0).default(0),
  horizonMonths: z.number().int().min(1).max(24).default(3),
  monthlyIncome: z.number().min(0),
  monthlyExpenses: z.number().min(0),
  currentSavings: z.number().min(0),
  language: z.string().optional(),
});

// Zero numeric fields, same bar as narrate_verdict - the AI narrates two futures it did not
// compute and cannot alter.
export const narrateFutureComparisonSchema = z.object({
  narrative: z.string().min(1),
  key_consideration: z.string().min(1),
});
