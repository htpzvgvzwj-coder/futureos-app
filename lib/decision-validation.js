import { z } from "zod";

// Validates the body of POST /api/decision/check - a real-time cashflow snapshot, not an AI
// tool-call output, same discipline as every confirm endpoint in this app: only categorical/context
// values are trusted from the client, every dollar figure that matters is recomputed server-side in
// lib/decision-finance.js.
export const decisionCheckRequestSchema = z.object({
  description: z.string().min(1).max(400),
  amount: z.number().min(0),
  recurringMonthly: z.number().min(0).default(0),
  monthlyIncome: z.number().min(0),
  monthlyExpenses: z.number().min(0),
  currentSavings: z.number().min(0),
  language: z.string().optional(),
});

// Validates the narrate_verdict AI tool-call output. Deliberately has zero numeric fields - the
// verdict category and every number were already computed before the AI ever saw them.
export const narrateVerdictSchema = z.object({
  narrative: z.string().min(1),
  key_consideration: z.string().min(1),
});
