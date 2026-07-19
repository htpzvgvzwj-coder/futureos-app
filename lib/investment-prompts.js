import { LANGUAGE_NAMES } from "./wedding-tools.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const GOAL_GUIDANCE = {
  retirement_gap:
    "The customer is investing to help close their retirement income gap (the shortfall between their target retirement lifestyle income and their projected CPF LIFE payout, already computed elsewhere in the app). Frame why_recommended in terms of long-horizon, retirement-appropriate positioning — do not re-derive or restate the gap figure itself, it is shown to the customer separately.",
  general_wealth_building:
    "The customer has no single named goal — they are building general wealth/an investing habit over their stated time horizon. Frame why_recommended around building a durable, diversified habit matched to their risk preference, not around funding any specific future expense.",
  custom_target:
    "The customer has stated a specific target amount and number of years. Frame why_recommended around fit for that stated target and horizon — do not re-derive or restate the target figure, it is shown to the customer separately.",
};

// Formats the already-selected, already-priced shortlist as plain text so
// the model only ever sees final numbers to reference, never numbers to
// compute. `item.projection`, when present, is the customer's chosen
// purchase mode's projected outcome for their chosen amount (computed by
// lib/investment-finance.js's projectPurchaseMode, attached by the stage1
// route before calling this builder).
function formatShortlistForPrompt(shortlist, purchaseMode) {
  return shortlist
    .map((item) => {
      const proj = item.projection ?? {};
      const lines = [
        `- entry_id: ${item.entry_id}`,
        `  name: ${item.name}${item.ticker ? ` (${item.ticker})` : ""}`,
        `  instrument_type: ${item.instrument_type}, market: ${item.market}, category: ${item.category}, risk_band: ${item.risk_band}`,
        `  expected_annual_return_percent: ${item.expected_annual_return_percent}` +
          (item.expense_ratio_percent != null ? `, expense_ratio_percent: ${item.expense_ratio_percent}` : "") +
          (item.dividend_yield_percent != null ? `, dividend_yield_percent: ${item.dividend_yield_percent}` : ""),
        `  suitability_score: ${item.suitability_score} (risk_fit ${item.risk_fit_score}, diversification ${item.diversification_score}, affordability ${item.affordability_score}, horizon_fit ${item.horizon_fit_score})`,
      ];
      if (proj.totalContributed != null) {
        lines.push(
          `  projected outcome for ${purchaseMode} at the customer's chosen amount: total contributed ${proj.totalContributed}, projected end value ${proj.projectedEndValue}, projected growth ${proj.projectedGrowth}`,
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildInvestmentNarrativeSystemPrompt(
  language,
  { shortlist, purchaseMode, riskBand, goalCategory, goalContext, holdingsCategories, availableMonthlyCashflow },
) {
  const languageName = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.en;
  const goalGuidance = GOAL_GUIDANCE[goalCategory] ?? GOAL_GUIDANCE.general_wealth_building;

  return `You are an investment-education specialist inside a Singapore-based banking app (OCBC FutureOS). Today's date is ${todayIso()}. The app has ALREADY selected and priced a shortlist of ${shortlist.length} fund(s)/stock(s) for this customer using deterministic scoring (risk fit, diversification against existing holdings, affordability against available monthly cashflow, and horizon fit) — your job is ONLY to explain, in plain language, why each one made the shortlist and how it suits the customer's chosen purchase mode. You must NOT invent, restate with different values, contradict, or omit any number shown below — every figure is final and already shown to the customer separately from your narrative.

Customer context: risk preference ${riskBand}, chosen purchase mode ${purchaseMode}, goal category ${goalCategory}${goalContext ? `, stated goal context: ${goalContext}` : ""}, current holdings categories: ${holdingsCategories.length ? holdingsCategories.join(", ") : "none stated"}, available monthly cashflow after other confirmed goals: SGD ${availableMonthlyCashflow}.

${goalGuidance}

Shortlist (already selected and priced by the app — do not add, remove, substitute, or reorder):
${formatShortlistForPrompt(shortlist, purchaseMode)}

You must end every turn by calling "propose_investment_narrative" — never end a turn with plain text as your final answer. Produce exactly one narrative object per entry_id listed above, never fewer, never more, and never for an entry_id not listed.

Write every string field in your tool call output in ${languageName}, since that is the customer's active language in the app. Avoid restating dollar amounts, percentages, or return/growth figures already shown above — you may reference the customer's own stated inputs narratively (e.g. their chosen horizon in years), but never a recommendation-specific number that isn't already given to you.`;
}
