// Local, deterministic stand-in for the Anthropic call used only when the real API request fails
// (e.g. no API credits) - see app/api/retirement/stage1|stage2/route.js. Mirrors lib/home-mock.js's
// pattern. The mock only ever supplies `target_monthly_income` and categorical fields - every real
// CPF projection, Retirement Sum reference, and CPF LIFE payout figure still comes from
// lib/retirement-finance.js's real CPF Board formulas via attachFinancials, exactly as it would for
// a real Anthropic response. Clearly flagged with `mocked: true` in the route response.

const QUOTED_NAME_PATTERN = /"[^"]{2,80}"/;
const CONFIRM_WORD_PATTERN = /\b(confirm|final(ize)?|lock (it|that) in)\b/i;
const PLAN_LETTER_PATTERN = /\bplan\s*([abc123])\b/i;

export function looksLikeConfirmation(message) {
  if (PLAN_LETTER_PATTERN.test(message)) return true;
  return QUOTED_NAME_PATTERN.test(message) && CONFIRM_WORD_PATTERN.test(message);
}

function findMatchingOption(message, options) {
  const quoteMatch = message.match(/"([^"]{2,80})"/);
  if (quoteMatch) {
    const byName = options.find((o) => o.name.toLowerCase() === quoteMatch[1].toLowerCase());
    if (byName) return byName;
  }
  const letterMatch = message.match(PLAN_LETTER_PATTERN);
  if (letterMatch) {
    const index = "abc123".indexOf(letterMatch[1].toLowerCase()) % options.length;
    return options[Math.max(0, index)];
  }
  return options[0];
}

function futureDate(monthsAhead) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

const PLAN_TEMPLATES = [
  {
    name: "Local Comfortable Retirement",
    lifestyle_category: "local_comfortable",
    target_monthly_income: 3500,
    estimate_basis:
      "[Simulated] Approximate monthly spend for a comfortable local retirement (housing paid off, local travel, healthcare buffer) based on general cost-of-living references - not a live market search.",
    cpf_life_plan: "standard",
    payout_age: 65,
    assumptions_note:
      "[Simulated] Assumes CPF LIFE Standard Plan payouts starting at 65, on top of any personal savings drawn down separately - verify against your own CPF Retirement Account statement.",
  },
  {
    name: "Global Travel Retirement",
    lifestyle_category: "global_travel",
    target_monthly_income: 6000,
    estimate_basis:
      "[Simulated] Approximate monthly spend for an active retirement with regular overseas travel, based on general cost-of-living references - not a live market search.",
    cpf_life_plan: "escalating",
    payout_age: 65,
    assumptions_note:
      "[Simulated] Assumes CPF LIFE Escalating Plan payouts starting at 65, growing ~2%/year, supplemented by personal investments to cover travel spending above CPF LIFE - verify against your own CPF Retirement Account statement.",
  },
];

export function buildMockPlanOptions() {
  const plans = PLAN_TEMPLATES.map((template, index) => ({
    id: `mock-retirement-plan-${index + 1}`,
    name: template.name,
    summary: `[Simulated] A ${index === 0 ? "modest, locally-based" : "higher-spend, travel-oriented"} retirement lifestyle, using a template income estimate rather than a live cost-of-living search.`,
    lifestyle_category: template.lifestyle_category,
    target_monthly_income: template.target_monthly_income,
    estimate_basis: template.estimate_basis,
    cpf_life_plan: template.cpf_life_plan,
    payout_age: template.payout_age,
    assumptions_note: template.assumptions_note,
  }));

  return {
    plans,
    research_notes:
      "[Simulated response - no live Anthropic API call was made, so these are template income estimates for testing the app's pipeline, not a real cost-of-living search. CPF/Retirement Sum/CPF LIFE figures are still computed from real CPF Board formulas either way.]",
  };
}

export function buildMockPlanConfirmation(message, previousPlanOptions) {
  const plans = previousPlanOptions?.plans ?? buildMockPlanOptions().plans;
  const chosen = findMatchingOption(message, plans) ?? plans[0];

  return {
    plan_id: chosen.id,
    lifestyle_category: chosen.lifestyle_category,
    target_monthly_income: chosen.target_monthly_income,
    estimate_basis: chosen.estimate_basis,
    cpf_life_plan: chosen.cpf_life_plan,
    payout_age: chosen.payout_age,
    assumptions_note: chosen.assumptions_note,
    confirmation_note: "[Simulated] Customer confirmed this plan - no live Anthropic API call was made.",
  };
}

export function buildMockSavingsPlanOptions(confirmedPlan, profile) {
  const gap = Math.max(Number(confirmedPlan.gap_monthly ?? 500), 50);
  const available = Math.max(Number(profile.monthlyIncome ?? 7500) - Number(profile.monthlyExpenses ?? 3600), 200);
  const steadyMonthly = Math.max(50, Math.min(Math.round(gap * 0.6 / 10) * 10, Math.round(available * 0.4)));
  const balancedMonthly = Math.max(steadyMonthly + 50, Math.min(Math.round(gap * 0.9 / 10) * 10, Math.round(available * 0.6)));

  function buildStrategy(id, name, monthly, vehicles) {
    const timeline = [12, 24, 36].map((m) => ({
      month: futureDate(m),
      cumulative_saved: Math.round(monthly * m),
    }));
    return {
      id,
      name,
      summary: `[Simulated] Set aside ${monthly}/month to help close the gap between CPF LIFE payouts and your target retirement income.`,
      monthly_contribution: monthly,
      allocation: vehicles.map((v) => ({
        vehicle: v.vehicle,
        monthly_amount: v.amount,
        rationale: v.rationale,
        product_ref: v.product_ref,
        risk_note: v.risk_note,
      })),
      projected_timeline: timeline,
      suitability: {
        goal_supported: "Retirement income gap",
        data_used: `Monthly income SGD ${profile.monthlyIncome}, monthly expenses SGD ${profile.monthlyExpenses}, projected CPF LIFE gap SGD ${gap}/month.`,
        reason: "[Simulated] Template savings pacing for pipeline testing, not a real financial recommendation.",
        risk: "Low to moderate - simulated response.",
        alternative_considered: "N/A - simulated response.",
        limitation: "This is a simulated response for testing; no live AI reasoning was applied.",
        human_review_required: false,
      },
    };
  }

  return {
    strategies: [
      buildStrategy("mock-retirement-strategy-1", "Steady CPF Top-up", steadyMonthly, [
        {
          vehicle: "cpf_ordinary_account",
          amount: steadyMonthly,
          rationale: "[Simulated] Voluntary CPF top-up, low-risk and boosts future CPF LIFE payouts.",
          product_ref: "CPF Retirement Sum Topping-Up Scheme",
          risk_note: "No market risk - principal protected, but funds are locked in until retirement age.",
        },
      ]),
      buildStrategy("mock-retirement-strategy-2", "Balanced SRS + Savings", balancedMonthly, [
        {
          vehicle: "srs_account",
          amount: Math.round(balancedMonthly * 0.6),
          rationale: "[Simulated] SRS contribution for tax relief plus long-term growth, invested conservatively.",
          product_ref: "Supplementary Retirement Scheme",
          risk_note: "Low-moderate market risk depending on SRS investment choice.",
        },
        {
          vehicle: "goal_based_deposit",
          amount: Math.round(balancedMonthly * 0.4),
          rationale: "[Simulated] Liquid savings buffer for near-term flexibility ahead of retirement.",
          product_ref: "OCBC Monthly Savings Account",
          risk_note: "No market risk - principal protected.",
        },
      ]),
    ],
  };
}

export function buildMockSavingsFinalization(message, previousStrategyOptions, confirmedPlan) {
  const strategies =
    previousStrategyOptions?.strategies ??
    buildMockSavingsPlanOptions(confirmedPlan, { monthlyIncome: 7500, monthlyExpenses: 3600 }).strategies;
  const chosen = findMatchingOption(message, strategies) ?? strategies[0];

  return {
    strategy_id: chosen.id,
    monthly_contribution: chosen.monthly_contribution,
    allocation: chosen.allocation,
    start_month: futureDate(0),
    target_complete_month: futureDate(36),
    notes: "[Simulated] Customer finalised this savings plan - no live Anthropic API call was made.",
  };
}
