// Local, deterministic stand-in for the Anthropic call used only when the real API request fails
// (e.g. no API credits) - see app/api/home/stage1|stage2/route.js. Mirrors lib/wedding-mock.js's
// pattern. The mock only ever supplies `estimated_price` and categorical fields - every real
// financial figure (BSD, ABSD, loan amount, down payment, affordability) still comes from
// lib/home-finance.js's real regulatory formulas via attachFinancials, exactly as it would for a
// real Anthropic response. Clearly flagged with `mocked: true` in the route response.

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

const TIMELINE_TEMPLATE = [
  { activity_id: "viewing", label: "Property viewings", start_offset_months: 1, duration_months: 2, notes: "Shortlist and view units" },
  { activity_id: "otp", label: "Option to Purchase", start_offset_months: 3, duration_months: 1, notes: "Exercise OTP, pay option fee" },
  { activity_id: "loan", label: "Mortgage approval", start_offset_months: 4, duration_months: 1, notes: "Finalise home loan with the bank" },
  { activity_id: "completion", label: "Completion / key collection", start_offset_months: 8, duration_months: 1, notes: "Legal completion and handover" },
];

const PLAN_TEMPLATES = [
  {
    name: "HDB Resale, Punggol/Sengkang",
    property_type: "hdb_resale",
    district: "Punggol / Sengkang",
    resale_or_new: "resale",
    unit_type: "4-room flat, ~90 sqm",
    estimated_price: 580000,
    estimate_basis: "[Simulated] Approximate resale 4-room flat range for Punggol/Sengkang based on recent general market levels - not a live HDB resale portal lookup.",
    eligibility_notes: "[Simulated] Subject to MOP if applicable, CPF Housing Grant eligibility depends on income ceiling and citizenship - verify on the HDB website.",
  },
  {
    name: "Mass-Market Condo, North-East Region",
    property_type: "condo",
    district: "North-East Region",
    resale_or_new: "resale",
    unit_type: "2-bedroom condo, ~70 sqm",
    estimated_price: 1350000,
    estimate_basis: "[Simulated] Approximate mass-market resale condo range in the North-East region based on general market levels - not a live URA transaction lookup.",
    eligibility_notes: "[Simulated] No MOP restriction for private property, but ABSD applies if this isn't your first residential property - verify your specific situation with IRAS.",
  },
];

export function buildMockPlanOptions() {
  const plans = PLAN_TEMPLATES.map((template, index) => ({
    id: `mock-home-plan-${index + 1}`,
    name: template.name,
    summary: `[Simulated] A ${index === 0 ? "more affordable, HDB resale" : "higher-end, private condo"} option, using a template price estimate rather than a live market search.`,
    property_type: template.property_type,
    district: template.district,
    resale_or_new: template.resale_or_new,
    unit_type: template.unit_type,
    estimated_price: template.estimated_price,
    estimate_basis: template.estimate_basis,
    eligibility_notes: template.eligibility_notes,
    timeline: TIMELINE_TEMPLATE,
  }));

  return {
    plans,
    research_notes:
      "[Simulated response - no live Anthropic API call was made, so these are template price estimates for testing the app's pipeline, not a real market search. BSD/ABSD/loan figures are still computed from real regulatory formulas either way.]",
  };
}

export function buildMockPlanConfirmation(message, previousPlanOptions) {
  const plans = previousPlanOptions?.plans ?? buildMockPlanOptions().plans;
  const chosen = findMatchingOption(message, plans) ?? plans[0];

  return {
    plan_id: chosen.id,
    property_type: chosen.property_type,
    district: chosen.district,
    resale_or_new: chosen.resale_or_new,
    unit_type: chosen.unit_type,
    estimated_price: chosen.estimated_price,
    estimate_basis: chosen.estimate_basis,
    eligibility_notes: chosen.eligibility_notes,
    timeline: chosen.timeline,
    confirmation_note: "[Simulated] Customer confirmed this plan - no live Anthropic API call was made.",
  };
}

export function buildMockSavingsPlanOptions(financedPlan, profile) {
  const target = Number(financedPlan.down_payment_cash_cpf ?? financedPlan.min_cash_component ?? 100000);
  const available = Math.max(Number(profile.monthlyIncome ?? 7500) - Number(profile.monthlyExpenses ?? 3600), 200);
  const conservativeMonthly = Math.min(Math.round(target / 24 / 10) * 10, Math.round(available * 0.5));
  const balancedMonthly = Math.min(Math.round(target / 18 / 10) * 10, Math.round(available * 0.7));

  function buildStrategy(id, name, monthly) {
    const months = Math.max(1, Math.ceil(target / monthly));
    const timeline = [0, Math.floor(months / 2), months].map((m) => ({
      month: futureDate(m),
      cumulative_saved: Math.min(target, monthly * m),
    }));
    return {
      id,
      name,
      summary: `[Simulated] Save ${monthly}/month toward the down payment.`,
      monthly_contribution: monthly,
      allocation: [
        {
          vehicle: "goal_based_deposit",
          monthly_amount: monthly,
          rationale: "[Simulated] Ring-fenced goal savings, kept liquid since the down payment is needed on a known timeline.",
          product_ref: "OCBC Monthly Savings Account",
          risk_note: "No market risk - principal protected.",
        },
      ],
      projected_timeline: timeline,
      suitability: {
        goal_supported: "Home down payment",
        data_used: `Monthly income SGD ${profile.monthlyIncome}, monthly expenses SGD ${profile.monthlyExpenses}, down payment target SGD ${target}.`,
        reason: "[Simulated] Template savings pacing for pipeline testing, not a real financial recommendation.",
        risk: "Low - simulated response.",
        alternative_considered: "N/A - simulated response.",
        limitation: "This is a simulated response for testing; no live AI reasoning was applied.",
        human_review_required: false,
      },
    };
  }

  return {
    strategies: [
      buildStrategy("mock-home-strategy-1", "Steady Pace", conservativeMonthly),
      buildStrategy("mock-home-strategy-2", "Faster Payoff", balancedMonthly),
    ],
  };
}

export function buildMockSavingsFinalization(message, previousStrategyOptions, financedPlan) {
  const strategies =
    previousStrategyOptions?.strategies ??
    buildMockSavingsPlanOptions(financedPlan, { monthlyIncome: 7500, monthlyExpenses: 3600 }).strategies;
  const chosen = findMatchingOption(message, strategies) ?? strategies[0];
  const target = Number(financedPlan.down_payment_cash_cpf ?? financedPlan.min_cash_component ?? 100000);
  const months = Math.max(1, Math.ceil(target / chosen.monthly_contribution));

  return {
    strategy_id: chosen.id,
    monthly_contribution: chosen.monthly_contribution,
    allocation: chosen.allocation,
    start_month: futureDate(0),
    target_complete_month: futureDate(months),
    notes: "[Simulated] Customer finalised this savings plan - no live Anthropic API call was made.",
  };
}
