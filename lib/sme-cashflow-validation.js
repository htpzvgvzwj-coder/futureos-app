import { z } from "zod";

// A real cash-flow event, entered by the business owner - amount is signed
// (positive = income, negative = expense), dayOfMonth is when it real
// recurs each month. Only categorical/context values are trusted from the
// client - the forecast itself is entirely recomputed server-side in
// lib/sme-cashflow-finance.js, never trusted from the client or the AI.
const cashflowEventSchema = z.object({
  label: z.string().min(1).max(80),
  amount: z.number(),
  dayOfMonth: z.number().int().min(1).max(30),
});

export const smeCashflowRequestSchema = z.object({
  businessName: z.string().min(1).max(120),
  startingCash: z.number().min(0),
  events: z.array(cashflowEventSchema).min(1).max(20),
  horizonDays: z.number().int().min(7).max(90).default(30),
  language: z.string().optional(),
});

// Zero numeric fields - the forecast, the gap day, and the real fix
// candidate are all already decided before the AI ever sees them.
export const narrateCashflowSchema = z.object({
  narrative: z.string().min(1),
  key_consideration: z.string().min(1),
});
