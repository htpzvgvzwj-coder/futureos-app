import { z } from "zod";

export const activityCheckRequestSchema = z.object({
  description: z.string().min(1).max(400),
  amount: z.number().min(0),
  monthlyIncome: z.number().min(0),
  language: z.string().optional(),
});

// Zero numeric fields - hasHistory/unusual and every number are already
// decided by lib/activity-check-finance.js before the AI ever sees them.
export const narrateActivityCheckSchema = z.object({
  narrative: z.string().min(1),
  key_consideration: z.string().min(1),
});
