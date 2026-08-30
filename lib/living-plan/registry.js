// Living Plan Engine - the registry every goal declares itself into, so
// "what can the user change here, what can't they break, what does it
// touch, what stage is it at, which system behaviours run on it" has one
// shape across every domain instead of a bespoke form + card per planner.
//
// A domain that is not a Living Plan yet is registered honestly as
// `{ registered: false }` - never faked.

export const LIVING_PLAN_STAGES = ["insight", "exploring", "compared", "pinned", "ready", "needs_approval", "active", "adapted", "completed", "paused"];

// The seven system behaviours (lib/living-plan/* + lib/guardian/*).
export const SYSTEM_BEHAVIOURS = [
  "released_future", // lib/living-plan/{allocation,future-fragment}.js  (shipped)
  "promise_weight", // lib/living-plan/promise-weight.js
  "decision_echo", // lib/living-plan/decision-echo.js
  "turning_point", // lib/living-plan/turning-point.js
  "future_handoff", // lib/living-plan/future-handoff.js
  "shadow_guardian", // lib/guardian/shadow-guardian.js
  "memory_lens", // lib/living-plan/memory-lens.js
];

const wedding = {
  domain: "wedding",
  registered: true,
  futureFieldDomain: "wedding",
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
  allocationTargets: ["home", "emergency", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "allocate", "catchup"],
  behaviours: ["released_future", "promise_weight", "turning_point", "future_handoff", "memory_lens"],
  replay: "change-ledger",
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
  allocationTargets: ["emergency", "retirement", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "allocate", "catchup"],
  behaviours: ["promise_weight", "released_future", "shadow_guardian", "turning_point", "future_handoff"],
  replay: "change-ledger",
};

const emergency = {
  domain: "emergency",
  registered: true,
  futureFieldDomain: "emergency",
  variables: [
    { key: "target_months", kind: "count", source: "user" },
    { key: "floor_months", kind: "count", source: "user" },
    { key: "monthly_contribution", kind: "money", source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "no_guardian_auto_move"],
  evidence: [
    { field: "available_liquid_savings", source: "bank" },
    { field: "monthly_expenses", source: "bank" },
  ],
  nodes: ["emergency", "home", "wedding", "cashflow"],
  impacts: ["home", "wedding", "travel", "loan"],
  allocationTargets: ["emergency", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "catchup"],
  behaviours: ["promise_weight", "shadow_guardian", "decision_echo", "turning_point"],
  replay: "change-ledger",
};

// Not yet a Living Plan - the planner still exists, but no Future Field
// adapter / cross-goal wiring. Declared here so the app shows an honest
// "not a Living Plan yet" rather than pretending.
function stub(domain, behaviours) {
  return { domain, registered: false, reason: "not_a_living_plan_yet", plannedBehaviours: behaviours };
}

const loan = {
  domain: "loan",
  registered: true,
  futureFieldDomain: "loan",
  variables: [
    { key: "extra_repayment", kind: "money", source: "user" },
    { key: "monthly_installment", kind: "money", source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "no_guardian_auto_move"],
  evidence: [
    { field: "confirmed_loan", source: "bank" },
    { field: "monthly_free_cashflow", source: "bank" },
    { field: "amortization_schedule", source: "reference" },
  ],
  nodes: ["loan", "emergency", "home", "investment", "cashflow"],
  impacts: ["emergency", "home", "investment", "cashflow"],
  allocationTargets: ["home", "emergency", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "allocate", "catchup"],
  behaviours: ["promise_weight", "released_future", "future_handoff", "shadow_guardian"],
  replay: "change-ledger",
};

const retirement = {
  domain: "retirement",
  registered: true,
  futureFieldDomain: "retirement",
  variables: [
    { key: "monthly_contribution", kind: "money", source: "user" },
    { key: "target_monthly_income", kind: "money", source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "no_guardian_auto_move"],
  evidence: [
    { field: "confirmed_retirement_plan", source: "bank" },
    { field: "cpf_life_payout_estimate", source: "reference" },
    { field: "monthly_income", source: "bank" },
  ],
  nodes: ["retirement", "home", "wedding", "family", "cashflow"],
  impacts: ["home", "wedding", "family", "cashflow"],
  allocationTargets: ["home", "emergency", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "allocate", "catchup"],
  behaviours: ["decision_echo", "future_handoff", "memory_lens", "turning_point"],
  replay: "change-ledger",
};

const REGISTRY = {
  wedding,
  home,
  emergency,
  loan,
  retirement,
  investment: stub("investment", ["released_future", "decision_echo", "promise_weight", "future_handoff"]),
  insurance: stub("insurance", ["turning_point", "memory_lens", "promise_weight"]),
  travel: stub("travel", ["released_future", "decision_echo", "future_handoff"]),
  family: stub("family", ["turning_point", "promise_weight", "memory_lens"]),
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
