import { z } from "zod";

export const mirrorDebateSchema = z.object({
  bullCase: z.string().min(1),
  bearCase: z.string().min(1),
  bearRiskTag: z.enum(["income_disruption", "rate_increase", "expense_shock", "timeline_slip", "market_downturn", "other"]),
  judgeSynthesis: z.string().min(1),
  recommendedAction: z.enum(["proceed", "proceed_with_adjustment", "wait", "reconsider"]),
  confidence: z.enum(["low", "medium", "high"]),
});
