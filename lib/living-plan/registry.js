// Living Plan Engine - the registry every goal declares itself into, so
// "what can the user change here, what can't they break, what does it
// touch, what stage is it at" has one shape across every domain instead of
// a bespoke form + card per planner.
//
// This is a SPEC layer (pure data + small helpers). The runtime that acts
// on it is lib/plan-runtime/* and lib/future-field/*; the UI that renders
// it is app/components/future-field-canvas.jsx + app/features/*. A domain
// that is not a Living Plan yet is registered honestly as
// `{ registered: false }` - never faked.

// stage vocabulary (mirrors lib/plan-runtime/state-machine.js's ledger
// mapping, phrased for the customer).
export const LIVING_PLAN_STAGES = ["insight", "exploring", "compared", "pinned", "ready", "needs_approval", "active", "adapted", "completed", "paused"];

const wedding = {
  domain: "wedding",
  registered: true,
  futureFieldDomain: "wedding", // has a real adapter in lib/future-field/adapters.js
  variables: [
    { key: "wedding_date", kind: "month", source: "user" },
    { key: "guest_count", kind: "count", source: "user" },
    { key: "venue_tier", kind: "enum", options: ["budget", "mid_range", "premium"], source: "user" },
    { key: "venue_type", kind: "enum", options: ["community", "restaurant", "hotel", "outdoor"], source: "user" },
    { key: "total_budget", kind: "money", source: "user" },
    { key: "monthly_contribution", kind: "money", source: "user" },
    { key: "partner_contribution", kind: "money", source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "min_core_guests", "no_balance_share", "no_guardian_auto_move"],
  evidence: [
    { field: "available_liquid_savings", source: "bank" },
    { field: "monthly_free_cashflow", source: "bank" },
    { field: "committed_monthly_total", source: "bank" },
    { field: "venue_cost", source: "estimate" },
    { field: "guest_count", source: "user" },
  ],
  nodes: ["wedding", "home", "emergency", "cashflow"],
  impacts: ["home", "emergency", "cashflow", "travel"],
  actions: ["peel", "bend", "pin", "seal", "catchup"],
  replay: "change-ledger", // GoalChangeHistory(goalId="wedding")
};

const home = {
  domain: "home",
  registered: true,
  futureFieldDomain: "home",
  variables: [
    { key: "estimated_price", kind: "money", source: "user" },
    { key: "target_complete_month", kind: "month", source: "user" },
    { key: "monthly_contribution", kind: "money", source: "user" },
    { key: "property_type", kind: "enum", options: ["hdb_new", "hdb_resale", "ec_new", "private"], source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "max_delay_months", "no_guardian_auto_move"],
  evidence: [
    { field: "available_liquid_savings", source: "bank" },
    { field: "monthly_free_cashflow", source: "bank" },
    { field: "down_payment_needed", source: "estimate" },
    { field: "mas_iras_rates", source: "reference" },
  ],
  nodes: ["home", "wedding", "emergency", "retirement", "cashflow"],
  impacts: ["wedding", "emergency", "retirement", "cashflow", "loan"],
  actions: ["peel", "bend", "pin", "seal", "catchup"],
  replay: "change-ledger",
};

// Not yet a Living Plan - the planner still exists, but it has no Future
// Field adapter / cross-goal wiring. Declared here so the app can show an
// honest "not a Living Plan yet" rather than pretending.
function stub(domain) {
  return { domain, registered: false, reason: "not_a_living_plan_yet" };
}

const REGISTRY = {
  wedding,
  home,
  emergency: stub("emergency"),
  investment: stub("investment"),
  retirement: stub("retirement"),
  loan: stub("loan"),
  insurance: stub("insurance"),
  travel: stub("travel"),
  family: stub("family"),
};

export function getLivingPlanSpec(domain) {
  return REGISTRY[domain] ?? null;
}

export function livingPlanDomains() {
  return Object.keys(REGISTRY);
}

export function registeredLivingPlanDomains() {
  return Object.values(REGISTRY).filter((s) => s.registered).map((s) => s.domain);
}

export function isLivingPlan(domain) {
  return Boolean(REGISTRY[domain]?.registered);
}
