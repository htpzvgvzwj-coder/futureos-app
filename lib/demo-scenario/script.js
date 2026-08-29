// Demo Scenario - a controlled, clearly-labelled walkthrough (pure def).
//
// EVERY value here is fixture data for a product demo. It is written to the
// signed-in account's own tables so the Change Ledger, Future Field and
// planners populate for real - but every record it creates carries
// `demo_scenario: true` and every ledger event a `cause.demo = true`, so it
// can always be told apart from a real customer's data and cleared.
//
// The nine steps match the brief's demo path exactly.

export const DEMO_MARKER = "demo_scenario";

export const DEMO_STEPS = [
  {
    key: "wedding_plan_created",
    order: 1,
    titleKey: "demoScenario.steps.wedding_plan_created",
    feature: "wedding",
  },
  {
    key: "date_and_guests_changed",
    order: 2,
    titleKey: "demoScenario.steps.date_and_guests_changed",
    feature: "wedding",
  },
  {
    key: "quote_to_plan",
    order: 3,
    titleKey: "demoScenario.steps.quote_to_plan",
    feature: "quote_to_plan",
  },
  {
    key: "impact_on_home_and_emergency",
    order: 4,
    titleKey: "demoScenario.steps.impact_on_home_and_emergency",
    feature: "home",
  },
  {
    key: "shadow_guardian",
    order: 5,
    titleKey: "demoScenario.steps.shadow_guardian",
    feature: "guardian",
  },
  {
    key: "seal_commitment",
    order: 6,
    titleKey: "demoScenario.steps.seal_commitment",
    feature: "wedding",
  },
  {
    key: "guardian_pause",
    order: 7,
    titleKey: "demoScenario.steps.guardian_pause",
    feature: "guardian",
  },
  {
    key: "plan_rescue",
    order: 8,
    titleKey: "demoScenario.steps.plan_rescue",
    feature: "emergency",
  },
  {
    key: "wedding_handover",
    order: 9,
    titleKey: "demoScenario.steps.wedding_handover",
    feature: "wedding",
  },
];

// Fixture numbers - a Singapore couple, ~100-guest wedding in 2028, also
// saving for a resale flat. Deliberately round and legible for a demo.
export const DEMO_FIXTURE = {
  couple: { partnerAContribution: 1400, partnerBContribution: 1400 },
  wedding: {
    v1: { location: "Singapore", date: "2028-10", guests: 100, total_budget: 62000, truthfulness: "estimate" },
    v2: { location: "Singapore", date: "2028-06", guests: 120, total_budget: 71000, truthfulness: "estimate" },
    venueQuote: { field: "venue_cost", label: "Wedding venue", estimateLow: 12000, estimateHigh: 18000, quotedAmount: 15800, validDays: 4 },
    monthlySavings: 1180,
    rescueDelayWeeks: 6,
    handoverResidual: 1240,
  },
  home: { estimated_price: 620000, property_type: "hdb_resale", monthlySavings: 1900 },
  shadow: { cyclesRun: 2, testedAmount: 1300, suggestedStableAmount: 1180 },
  emergency: { bufferBefore: 6.2, bufferAfter: 5.6, floor: 6 },
};

export function demoStepByKey(key) {
  return DEMO_STEPS.find((s) => s.key === key) ?? null;
}

export function nextDemoStep(completedKeys = []) {
  return DEMO_STEPS.find((s) => !completedKeys.includes(s.key)) ?? null;
}
