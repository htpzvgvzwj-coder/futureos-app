// Local, deterministic stand-in for the Anthropic call used only when the real API request fails
// (e.g. no API credits) - see app/api/wedding/stage1|stage2/route.js. Mirrors lib/other-mock.js's
// pattern. Every response is run through the same wedding-validation.js schemas as a real one,
// which means attachWeddingFinancials still computes venue/photography/attire from the REAL
// deterministic rate tables in lib/wedding-finance.js - only the long-tail line items (car,
// makeup, entertainment, favors, solemnization, decor, stationery) and the day-of timeline are
// templated here. Clearly flagged with `mocked: true` in the route response.

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

const LONG_TAIL_LINE_ITEM_SETS = [
  [
    { category: "solemnization", label: "Solemnization ceremony", unit_rate: 400, unit: "flat fee", quantity: 1, estimate_basis: "Typical solemnizer/celebrant fee plus basic ceremony setup in Singapore" },
    { category: "makeup", label: "Bridal hair & makeup", unit_rate: 600, unit: "flat fee", quantity: 1, estimate_basis: "Typical single-look bridal HMU package in Singapore" },
    { category: "car", label: "Wedding car rental", unit_rate: 500, unit: "flat fee", quantity: 1, estimate_basis: "Half-day decorated wedding car rental, typical Singapore rate" },
    { category: "stationery", label: "Invitations & stationery", unit_rate: 3, unit: "per guest", quantity: 80, estimate_basis: "Typical printed invitation cost per guest" },
  ],
  [
    { category: "solemnization", label: "Solemnization ceremony", unit_rate: 600, unit: "flat fee", quantity: 1, estimate_basis: "Solemnizer fee plus a more elaborate ceremony setup" },
    { category: "makeup", label: "Bridal hair & makeup (2 looks)", unit_rate: 1100, unit: "flat fee", quantity: 1, estimate_basis: "Two-look bridal HMU package, typical Singapore rate" },
    { category: "car", label: "Wedding car rental (premium)", unit_rate: 900, unit: "flat fee", quantity: 1, estimate_basis: "Full-day premium decorated wedding car rental" },
    { category: "entertainment", label: "Emcee & live band", unit_rate: 2500, unit: "flat fee", quantity: 1, estimate_basis: "Typical bilingual emcee plus a small live band package" },
    { category: "decor", label: "Additional floral & styling", unit_rate: 1200, unit: "flat fee", quantity: 1, estimate_basis: "Supplementary floral/styling beyond the venue's included decor" },
    { category: "stationery", label: "Invitations & stationery", unit_rate: 5, unit: "per guest", quantity: 100, estimate_basis: "Typical premium printed invitation cost per guest" },
  ],
];

const TIMELINE_TEMPLATE = [
  { activity_id: "solemnization", label: "Solemnization", start_offset_minutes: 0, duration_minutes: 30, notes: "Legal ceremony" },
  { activity_id: "gateCrash", label: "Gate crash & tea ceremony", start_offset_minutes: 60, duration_minutes: 90, notes: "Traditional games and tea ceremony with family" },
  { activity_id: "banquetStart", label: "Guests arrive, banquet begins", start_offset_minutes: 300, duration_minutes: 30, notes: "Cocktail reception before dinner service" },
  { activity_id: "speeches", label: "Speeches & toasts", start_offset_minutes: 360, duration_minutes: 20, notes: "Family and friends speeches" },
  { activity_id: "firstDance", label: "First dance", start_offset_minutes: 420, duration_minutes: 10, notes: "Couple's first dance" },
];

export function buildMockPlanOptions() {
  const names = ["Community & Budget-Conscious", "Comfortable Hotel Wedding"];
  const guestCounts = [80, 100];
  const venueOptions = [
    { venue_tier: "budget", venue_type: "community" },
    { venue_tier: "mid_range", venue_type: "hotel" },
  ];
  const photographyTiers = ["basic", "mid_range"];
  const attireTiers = ["budget", "mid_range"];

  const plans = LONG_TAIL_LINE_ITEM_SETS.map((items, index) => {
    const lineItems = items.map((item) => ({ ...item, subtotal: Math.round(item.unit_rate * item.quantity * 100) / 100 }));
    return {
      id: `mock-wedding-plan-${index + 1}`,
      name: names[index],
      summary: `[Simulated] A ${index === 0 ? "leaner, community-hall" : "more comfortable, hotel"} wedding option, itemised below. Venue/photography/attire are computed from real Singapore market rate tables, not simulated.`,
      total_cost: 0,
      currency: "SGD",
      guest_count: guestCounts[index],
      venue_tier: venueOptions[index].venue_tier,
      venue_type: venueOptions[index].venue_type,
      photography_tier: photographyTiers[index],
      attire_tier: attireTiers[index],
      line_items: lineItems,
      timeline: TIMELINE_TEMPLATE,
    };
  });

  return {
    plans,
    research_notes:
      "[Simulated response - no live Anthropic API call was made for the long-tail line items or timeline. Venue, photography, and attire figures are real, computed from Singapore market rate tables regardless.]",
  };
}

export function buildMockWeddingConfirmation(message, previousPlanOptions) {
  const plans = previousPlanOptions?.plans ?? buildMockPlanOptions().plans;
  const chosen = findMatchingOption(message, plans) ?? plans[0];

  return {
    plan_id: chosen.id,
    wedding_date: futureDate(12),
    total_budget: 0,
    currency: chosen.currency,
    guest_count: chosen.guest_count,
    venue_tier: chosen.venue_tier,
    venue_type: chosen.venue_type,
    photography_tier: chosen.photography_tier,
    attire_tier: chosen.attire_tier,
    line_items: chosen.line_items,
    timeline: chosen.timeline,
    confirmation_note: "[Simulated] Customer confirmed this plan - no live Anthropic API call was made.",
  };
}

export function buildMockSavingsPlanOptions(confirmedBudget, profile) {
  const available = Math.max(Number(profile.monthlyIncome ?? 7500) - Number(profile.monthlyExpenses ?? 3600), 200);
  const conservativeMonthly = Math.min(Math.round(confirmedBudget.total_budget / 14 / 10) * 10, Math.round(available * 0.5));
  const balancedMonthly = Math.min(Math.round(confirmedBudget.total_budget / 10 / 10) * 10, Math.round(available * 0.7));

  function buildStrategy(id, name, monthly) {
    const months = Math.max(1, Math.ceil(confirmedBudget.total_budget / monthly));
    const timeline = [0, Math.floor(months / 2), months].map((m) => ({
      month: futureDate(m),
      cumulative_saved: Math.min(confirmedBudget.total_budget, monthly * m),
    }));
    return {
      id,
      name,
      summary: `[Simulated] Save ${monthly}/month toward the wedding.`,
      monthly_contribution: monthly,
      allocation: [
        {
          vehicle: "goal_based_deposit",
          monthly_amount: monthly,
          rationale: "[Simulated] Ring-fenced goal savings, kept liquid since the wedding date is fixed.",
          product_ref: "OCBC Monthly Savings Account",
          risk_note: "No market risk - principal protected.",
        },
      ],
      projected_timeline: timeline,
      suitability: {
        goal_supported: "Wedding",
        data_used: `Monthly income SGD ${profile.monthlyIncome}, monthly expenses SGD ${profile.monthlyExpenses}.`,
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
      buildStrategy("mock-wedding-strategy-1", "Steady Pace", conservativeMonthly),
      buildStrategy("mock-wedding-strategy-2", "Faster Payoff", balancedMonthly),
    ],
  };
}

export function buildMockSavingsFinalization(message, previousStrategyOptions, confirmedBudget) {
  const strategies =
    previousStrategyOptions?.strategies ??
    buildMockSavingsPlanOptions(confirmedBudget, { monthlyIncome: 7500, monthlyExpenses: 3600 }).strategies;
  const chosen = findMatchingOption(message, strategies) ?? strategies[0];
  const months = Math.max(1, Math.ceil(confirmedBudget.total_budget / chosen.monthly_contribution));

  return {
    strategy_id: chosen.id,
    monthly_contribution: chosen.monthly_contribution,
    allocation: chosen.allocation,
    start_month: futureDate(0),
    target_complete_month: futureDate(months),
    notes: "[Simulated] Customer finalised this savings plan - no live Anthropic API call was made.",
  };
}
