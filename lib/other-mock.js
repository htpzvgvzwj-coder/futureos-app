// Local, deterministic stand-in for the Anthropic call used only when the real API request fails
// (e.g. no API credits during development) - see app/api/other/stage1|stage2/route.js. Every
// response returned here is shaped EXACTLY like the real tool_use.input the model would produce,
// and is run through the same zod schemas as the real path, so nothing downstream (validation,
// storage, UI) is aware it's talking to a mock instead of Claude. Clearly flagged with
// `mocked: true` in the route response so this is never confused with a real, grounded estimate.

// Deliberately narrow: only the app's own "Choose this plan/strategy" buttons (see
// otherPlanner.choosePlanMessage / chooseStrategyMessage in the locale files) produce a message
// shaped like this - a quoted plan/strategy name plus an explicit confirm word - or the customer
// names a specific "plan A/B/C". A loose keyword match (e.g. just "go with" or "final") false-
// positived on ordinary free-text refinement messages like "let's make it more comfortable, I'll
// go with the pricier option" during testing, which has no specific plan named yet and should
// propose new options, not silently confirm the old one.
const QUOTED_NAME_PATTERN = /"[^"]{2,80}"/;
const CONFIRM_WORD_PATTERN = /\b(confirm|final(ize)?|lock (it|that) in)\b/i;
const PLAN_LETTER_PATTERN = /\bplan\s*([abc123])\b/i;

export function looksLikeConfirmation(message) {
  if (PLAN_LETTER_PATTERN.test(message)) return true;
  return QUOTED_NAME_PATTERN.test(message) && CONFIRM_WORD_PATTERN.test(message);
}

const TOPIC_TEMPLATES = [
  {
    match: /\b(trip|travel|backpack|vacation|holiday|tour|europe|japan|thailand|country|countries|flight)\b/i,
    topic: "trip",
    lineItemSets: [
      [
        { category: "flights", label: "Round-trip flights", unit_rate: 850, unit: "per person", quantity: 1, estimate_basis: "Typical economy round-trip fare for the described route based on recent fare comparisons" },
        { category: "accommodation", label: "Budget accommodation", unit_rate: 45, unit: "per night", quantity: 21, estimate_basis: "Hostel/budget guesthouse average nightly rate across the described region" },
        { category: "food", label: "Meals and local transport", unit_rate: 40, unit: "per day", quantity: 21, estimate_basis: "Budget traveller daily spend estimate for food and local transit" },
        { category: "activities", label: "Activities and entry fees", unit_rate: 300, unit: "flat fee", quantity: 1, estimate_basis: "Typical spend on attractions/tours for a multi-country budget itinerary" },
      ],
      [
        { category: "flights", label: "Round-trip flights (flexible dates)", unit_rate: 650, unit: "per person", quantity: 1, estimate_basis: "Lower fare achievable with flexible/off-peak travel dates" },
        { category: "accommodation", label: "Mixed hostel/budget hotel stays", unit_rate: 60, unit: "per night", quantity: 21, estimate_basis: "Blended average of hostel dorms and occasional private rooms" },
        { category: "food", label: "Meals and local transport", unit_rate: 45, unit: "per day", quantity: 21, estimate_basis: "Slightly higher daily spend allowing more restaurant meals" },
        { category: "activities", label: "Activities and entry fees", unit_rate: 450, unit: "flat fee", quantity: 1, estimate_basis: "More guided tours and paid attractions included" },
        { category: "insurance", label: "Travel insurance", unit_rate: 120, unit: "flat fee", quantity: 1, estimate_basis: "Standard multi-country travel insurance premium for the trip duration" },
      ],
    ],
  },
  {
    match: /\b(course|degree|tuition|certificat|bootcamp|study|education|mba|diploma)\b/i,
    topic: "education",
    lineItemSets: [
      [
        { category: "tuition", label: "Course tuition fees", unit_rate: 8000, unit: "flat fee", quantity: 1, estimate_basis: "Typical tuition range for a comparable part-time programme" },
        { category: "materials", label: "Study materials and software", unit_rate: 400, unit: "flat fee", quantity: 1, estimate_basis: "Textbooks, tools, and any required licences" },
        { category: "exam", label: "Certification/exam fees", unit_rate: 350, unit: "flat fee", quantity: 1, estimate_basis: "Standard external certification exam fee" },
      ],
      [
        { category: "tuition", label: "Course tuition fees (premium track)", unit_rate: 12000, unit: "flat fee", quantity: 1, estimate_basis: "Higher-tier programme with smaller cohort/more mentoring" },
        { category: "materials", label: "Study materials and software", unit_rate: 400, unit: "flat fee", quantity: 1, estimate_basis: "Textbooks, tools, and any required licences" },
        { category: "exam", label: "Certification/exam fees", unit_rate: 350, unit: "flat fee", quantity: 1, estimate_basis: "Standard external certification exam fee" },
      ],
    ],
  },
];

const GENERIC_LINE_ITEM_SETS = [
  [
    { category: "core", label: "Core cost", unit_rate: 5000, unit: "flat fee", quantity: 1, estimate_basis: "Baseline estimate for the described goal, mid-range option" },
    { category: "extras", label: "Extras and contingency", unit_rate: 500, unit: "flat fee", quantity: 1, estimate_basis: "Standard ~10% buffer for incidental costs" },
  ],
  [
    { category: "core", label: "Core cost (premium)", unit_rate: 7500, unit: "flat fee", quantity: 1, estimate_basis: "Higher-tier version of the same goal" },
    { category: "extras", label: "Extras and contingency", unit_rate: 750, unit: "flat fee", quantity: 1, estimate_basis: "Standard ~10% buffer for incidental costs" },
  ],
];

function pickTemplate(message) {
  const found = TOPIC_TEMPLATES.find((t) => t.match.test(message));
  return found ?? { topic: "goal", lineItemSets: GENERIC_LINE_ITEM_SETS };
}

function withSubtotal(items) {
  return items.map((item) => ({ ...item, subtotal: Math.round(item.unit_rate * item.quantity * 100) / 100 }));
}

function futureDate(monthsAhead) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

export function buildMockPlanOptions(message) {
  const template = pickTemplate(message);
  const names =
    template.topic === "trip"
      ? ["Lean Budget Route", "Comfortable Budget Route"]
      : template.topic === "education"
        ? ["Standard Track", "Premium Track"]
        : ["Lean Option", "Comfortable Option"];

  const plans = template.lineItemSets.map((items, index) => {
    const lineItems = withSubtotal(items);
    return {
      id: `mock-plan-${index + 1}`,
      name: names[index] ?? `Option ${index + 1}`,
      summary: `[Simulated] A ${index === 0 ? "leaner" : "more comfortable"} version of the goal you described, itemised below.`,
      total_cost: lineItems.reduce((sum, i) => sum + i.subtotal, 0),
      currency: "SGD",
      target_date: futureDate(12),
      line_items: lineItems,
    };
  });

  return {
    plans,
    research_notes:
      "[Simulated response - no live Anthropic API call was made. These are template estimates for testing the app's pipeline, not real market research.]",
  };
}

// The real "Choose this plan" button always quotes the exact plan name (see
// otherPlanner.choosePlanMessage), so that's checked first; "plan A/B/C" is a fallback for a
// customer typing a letter reference directly; defaulting to the first option only if neither
// matches (e.g. a bare "confirm" with nothing else to go on).
function findMatchingPlan(message, plans) {
  const quoteMatch = message.match(/"([^"]{2,80})"/);
  if (quoteMatch) {
    const byName = plans.find((p) => p.name.toLowerCase() === quoteMatch[1].toLowerCase());
    if (byName) return byName;
  }
  const letterMatch = message.match(PLAN_LETTER_PATTERN);
  if (letterMatch) {
    const index = "abc123".indexOf(letterMatch[1].toLowerCase()) % plans.length;
    return plans[Math.max(0, index)];
  }
  return plans[0];
}

export function buildMockGoalConfirmation(message, previousPlanOptions) {
  const plans = previousPlanOptions?.plans ?? buildMockPlanOptions(message).plans;
  const chosen = findMatchingPlan(message, plans) ?? plans[0];

  return {
    plan_id: chosen.id,
    goal_name: chosen.name,
    target_date: chosen.target_date,
    total_budget: chosen.total_cost,
    currency: chosen.currency,
    line_items: chosen.line_items,
    confirmation_note: "[Simulated] Customer confirmed this plan - no live Anthropic API call was made.",
  };
}

export function buildMockSavingsPlanOptions(confirmedPlan, profile) {
  const available = Math.max(Number(profile.monthlyIncome ?? 7500) - Number(profile.monthlyExpenses ?? 3600), 200);
  const conservativeMonthly = Math.min(Math.round(confirmedPlan.total_budget / 12 / 10) * 10, Math.round(available * 0.5));
  const balancedMonthly = Math.min(Math.round(confirmedPlan.total_budget / 8 / 10) * 10, Math.round(available * 0.7));

  function buildStrategy(id, name, monthly) {
    const months = Math.max(1, Math.ceil(confirmedPlan.total_budget / monthly));
    const timeline = [0, Math.floor(months / 2), months].map((m) => ({
      month: futureDate(m),
      cumulative_saved: Math.min(confirmedPlan.total_budget, monthly * m),
    }));
    return {
      id,
      name,
      summary: `[Simulated] Save ${monthly}/month toward "${confirmedPlan.goal_name}".`,
      monthly_contribution: monthly,
      allocation: [
        {
          vehicle: "goal_based_deposit",
          monthly_amount: monthly,
          rationale: "[Simulated] Ring-fenced goal savings, kept liquid since the target date is fixed.",
          product_ref: "OCBC Monthly Savings Account",
          risk_note: "No market risk - principal protected.",
        },
      ],
      projected_timeline: timeline,
      suitability: {
        goal_supported: confirmedPlan.goal_name,
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
      buildStrategy("mock-strategy-1", "Steady Pace", conservativeMonthly),
      buildStrategy("mock-strategy-2", "Faster Payoff", balancedMonthly),
    ],
  };
}

export function buildMockSavingsFinalization(message, previousStrategyOptions, confirmedPlan) {
  const strategies = previousStrategyOptions?.strategies ?? buildMockSavingsPlanOptions(confirmedPlan, { monthlyIncome: 7500, monthlyExpenses: 3600 }).strategies;
  const chosen = findMatchingPlan(message, strategies) ?? strategies[0];
  const months = Math.max(1, Math.ceil(confirmedPlan.total_budget / chosen.monthly_contribution));

  return {
    strategy_id: chosen.id,
    monthly_contribution: chosen.monthly_contribution,
    allocation: chosen.allocation,
    start_month: futureDate(0),
    target_complete_month: futureDate(months),
    notes: "[Simulated] Customer finalised this savings plan - no live Anthropic API call was made.",
  };
}
