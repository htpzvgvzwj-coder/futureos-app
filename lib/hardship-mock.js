// Local, deterministic stand-in for the Anthropic call used only when the
// real API request fails (e.g. no API credits) - see
// app/api/hardship/assess|propose-actions/route.js. Mirrors
// lib/wedding-mock.js's pattern: mocks only ever supply categorical/text
// fields, every real dollar figure still comes from lib/hardship-finance.js
// via the route's own server-side computation, exactly as it would for a
// real Anthropic response. Clearly flagged with `mocked: true`.
//
// Hardship is an emotionally sensitive domain in a way wedding/home mocks
// aren't - a customer here is describing real financial distress. A
// confidently WRONG mock classification (e.g. guessing "job_loss" for a
// customer who described a temporary pay cut) is worse than a generic
// wedding price estimate being off. buildMockAssessment deliberately
// defaults to the safest/most conservative reading rather than guessing
// hard, and every buildMockRecoveryActions action is marked
// human_review_required: true (unlike the lower-stakes sibling-domain
// mocks) since these are template guesses about a real hardship, not real
// reasoning about this customer's specific situation.

const JOB_LOSS_PATTERN = /\b(lost my job|laid off|retrenched|let go|terminated)\b/i;
const INCOME_REDUCTION_PATTERN = /\b(pay cut|reduced (income|pay|salary)|salary cut|cut my (pay|hours))\b/i;
const WINDFALL_PATTERN = /\b(severance|payout|insurance claim|inheritance|bonus|windfall)\b/i;
const AMOUNT_PATTERN = /(?:sgd|s\$|\$)\s?([\d,]+(?:\.\d+)?)/i;

function extractStatedAmount(message) {
  const match = message.match(AMOUNT_PATTERN);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export function buildMockAssessment(message) {
  // "other" is the safe default when neither pattern matches - never
  // guesses a specific category (job_loss/income_reduction) it can't
  // actually support from the text.
  const hardshipType = JOB_LOSS_PATTERN.test(message)
    ? "job_loss"
    : INCOME_REDUCTION_PATTERN.test(message)
      ? "income_reduction"
      : "other";
  const windfallMentioned = WINDFALL_PATTERN.test(message);
  const statedAmount = extractStatedAmount(message);

  return {
    hardship_type: hardshipType,
    // The more conservative/protective default (assume it could run past 6
    // months), not a confident guess dressed up as one.
    expected_duration: "temporary_6_to_12_months",
    stated_new_monthly_income: hardshipType === "income_reduction" ? statedAmount : null,
    windfall_mentioned: windfallMentioned,
    stated_windfall_amount: windfallMentioned ? statedAmount : null,
    narrative_summary:
      "[Simulated] This is a coarse, automated read of your message, not a real AI's understanding - no live Anthropic API call was made. Please review the details below and correct anything that doesn't match your real situation.",
  };
}

export function buildMockRecoveryActions(computed) {
  const actions = [];

  // amount/target_domain below are reference values only - the route's own
  // schema transform (lib/hardship-validation.js) recomputes and overwrites
  // both from real data regardless of what a mock (or a real AI) returns.
  if (computed.defaultDrawdown.suggested > 0) {
    actions.push({
      id: "mock-drawdown",
      action_type: "drawdown_emergency_fund",
      target_domain: null,
      amount: computed.defaultDrawdown.suggested,
      rationale: "[Simulated] A temporary drawdown from your emergency fund to cover the gap while things stabilise.",
      suitability: {
        goal_supported: "Cover the immediate monthly shortfall",
        data_used: `Monthly shortfall SGD ${computed.gap.monthlyShortfall}.`,
        reason: "[Simulated] Template recovery action for pipeline testing, not a real financial recommendation.",
        risk: "Reduces your emergency fund buffer - simulated response.",
        alternative_considered: "N/A - simulated response.",
        limitation: "This is a simulated response for testing; no live AI reasoning was applied.",
        human_review_required: true,
      },
    });
  }

  const largestDomain = computed.outflow.perDomain.filter((d) => d.monthly > 0).sort((a, b) => b.monthly - a.monthly)[0];
  if (largestDomain) {
    actions.push({
      id: "mock-reduce",
      action_type: "reduce_goal_plan",
      target_domain: largestDomain.domain,
      amount: largestDomain.monthly,
      rationale: `[Simulated] Temporarily reduce your ${largestDomain.domain} savings plan contribution to free up monthly cashflow.`,
      suitability: {
        goal_supported: `Free up monthly cashflow from the ${largestDomain.domain} goal`,
        data_used: `Current ${largestDomain.domain} contribution SGD ${largestDomain.monthly}/month.`,
        reason: "[Simulated] Template recovery action for pipeline testing, not a real financial recommendation.",
        risk: `Slows progress toward your ${largestDomain.domain} goal - simulated response.`,
        alternative_considered: "N/A - simulated response.",
        limitation: "This is a simulated response for testing; no live AI reasoning was applied.",
        human_review_required: true,
      },
    });
  }

  // Neither a real fund to draw down nor a real committed goal plan exists -
  // never fabricate an action against data that isn't there.
  if (!actions.length) {
    actions.push({
      id: "mock-support",
      action_type: "other_ocbc_support",
      target_domain: null,
      amount: 0,
      rationale: "[Simulated] Speak with a Relationship Manager to review options tailored to your situation.",
      suitability: {
        goal_supported: "General hardship support",
        data_used: "No active goal savings plans or emergency fund were found to compute an automatic action from.",
        reason: "[Simulated] Template fallback for pipeline testing, not a real financial recommendation.",
        risk: "None - this only suggests a human conversation.",
        alternative_considered: "N/A - simulated response.",
        limitation: "This is a simulated response for testing; no live AI reasoning was applied.",
        human_review_required: true,
      },
    });
  }

  return {
    actions,
    summary_note:
      "[Simulated response - no live Anthropic API call was made, so these are template recovery actions for testing the app's pipeline, not real AI reasoning. Every dollar amount is still computed from your real financial data either way.]",
  };
}
