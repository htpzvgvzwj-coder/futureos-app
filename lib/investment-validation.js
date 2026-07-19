import { z } from "zod";
import { HOLDINGS_CATEGORIES, PURCHASE_MODES, RISK_BANDS } from "./investment-catalog.js";

// Mirrors the other *-validation.js modules' shape-checking approach.
// Business-invariant checks (non-negative numbers, conditional requirements)
// live here since JSON Schema `strict: true` alone can't express them.

const GOAL_CATEGORIES = ["retirement_gap", "general_wealth_building", "custom_target"];

// Validates the body of POST /api/investment/intake — a structured UI pick,
// not an AI tool-call output. horizonYears is always required (used for
// shortlisting/scoring regardless of goal category); customTargetAmount is
// only required when goalCategory is "custom_target", never AI-interpreted.
export const investmentIntakeSchema = z
  .object({
    riskPreference: z.enum(RISK_BANDS),
    goalCategory: z.enum(GOAL_CATEGORIES),
    horizonYears: z.number().positive().max(50),
    customTargetAmount: z.number().positive().optional(),
    holdingsCategories: z.array(z.enum(HOLDINGS_CATEGORIES)).max(HOLDINGS_CATEGORIES.length),
    purchaseMode: z.enum(PURCHASE_MODES),
    monthlyIncome: z.number().min(0),
    monthlyExpenses: z.number().min(0),
  })
  .refine((body) => body.goalCategory !== "custom_target" || Boolean(body.customTargetAmount), {
    message: "customTargetAmount is required when goalCategory is 'custom_target'",
    path: ["customTargetAmount"],
  });

// Validates the propose_investment_narrative AI tool-call output. The
// stronger check — that narratives.entry_id exactly matches the shortlist's
// entry_ids, no fewer/more/different — needs the runtime shortlist, so it
// lives in app/api/investment/stage1/route.js, not here.
const narrative = z.object({
  entry_id: z.string().min(1),
  why_recommended: z.string().min(1),
  purchase_mode_commentary: z.string().min(1),
  risk_disclosure: z.string().min(1),
});

export const proposeInvestmentNarrativeSchema = z.object({
  narratives: z.array(narrative).min(1),
  portfolio_overview: z.string(),
  research_notes: z.string(),
});

// Validates the body of POST /api/investment/confirm — a structured pick
// (which catalog entry, which mode, how much, over what horizon), nothing
// for an LLM to interpret. entryId is looked up server-side against
// lib/investment-catalog.js; the client's own copy of instrument fields is
// never trusted.
export const confirmInvestmentSchema = z.object({
  entryId: z.string().min(1),
  purchaseMode: z.enum(PURCHASE_MODES),
  amount: z.number().positive(),
  horizonYears: z.number().positive().max(50),
  monthlyIncome: z.number().min(0),
  monthlyExpenses: z.number().min(0),
  currentSavings: z.number().min(0),
});
