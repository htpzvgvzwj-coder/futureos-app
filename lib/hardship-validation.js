import { z } from "zod";

// Stage1 (assessment) is pure classification of what the customer stated -
// no financial context needed to validate it, unlike stage2.
export const assessHardshipSchema = z.object({
  hardship_type: z.enum(["income_reduction", "job_loss", "one_time_expense", "windfall_with_gap", "other"]),
  expected_duration: z.enum(["temporary_under_6_months", "temporary_6_to_12_months", "indefinite", "one_time_no_recurrence"]),
  stated_new_monthly_income: z.number().min(0).nullable(),
  windfall_mentioned: z.boolean(),
  stated_windfall_amount: z.number().min(0).nullable(),
  narrative_summary: z.string().min(1),
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

// Mirrors lib/home-validation.js's "factory closes over computed financial
// context" pattern: the AI's own `amount` is accepted for schema validity
// but discarded here, replaced with the real computed figure for that
// action_type/target_domain, exactly like attachFinancials overwrites plan
// numbers in lib/home-validation.js. invest_excess/pause_goal_plan/
// reduce_goal_plan are also existence-gated here (not just left to the AI's
// judgment), since the app - not the model - knows which domains actually
// have a plan to pause and whether a windfall genuinely leaves an
// investable excess.
//
// `amount` on the returned action always means "the new monthly
// contribution after this action" for pause/reduce (0 for a full pause, a
// simple half-of-current default for a reduce - a named, explainable rule
// rather than something the model invents), and "the dollar amount moved"
// for drawdown/invest.
export function buildProposeRecoveryActionsSchema({ currentContributionByDomain, defaultDrawdown, windfallSplit }) {
  const recoveryAction = z
    .object({
      id: z.string().min(1),
      action_type: z.enum(["pause_goal_plan", "reduce_goal_plan", "drawdown_emergency_fund", "invest_excess", "other_ocbc_support"]),
      target_domain: z.enum(["wedding", "home", "retirement"]).nullable(),
      amount: z.number(),
      rationale: z.string().min(1),
      suitability,
    })
    .superRefine((action, ctx) => {
      const needsDomain = action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan";
      if (needsDomain && !action.target_domain) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "target_domain is required for pause_goal_plan/reduce_goal_plan" });
      }
      if (needsDomain && action.target_domain && !(action.target_domain in currentContributionByDomain)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `no confirmed savings plan exists for domain ${action.target_domain}` });
      }
      if (action.action_type === "invest_excess" && (!windfallSplit || windfallSplit.excessAvailable <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invest_excess is not valid without a windfall leaving a genuine excess" });
      }
    })
    .transform((action) => {
      if (action.action_type === "pause_goal_plan") {
        return { ...action, amount: 0 };
      }
      if (action.action_type === "reduce_goal_plan") {
        const current = currentContributionByDomain[action.target_domain];
        return { ...action, amount: Math.round(current / 2 / 10) * 10 };
      }
      if (action.action_type === "drawdown_emergency_fund") {
        return { ...action, amount: defaultDrawdown.suggested };
      }
      if (action.action_type === "invest_excess") {
        return { ...action, amount: windfallSplit.excessAvailable };
      }
      return { ...action, amount: 0 }; // other_ocbc_support carries no dollar figure
    });

  return z.object({
    actions: z.array(recoveryAction).min(1).max(4),
    summary_note: z.string(),
  });
}
