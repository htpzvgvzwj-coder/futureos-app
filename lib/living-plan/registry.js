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

const travel = {
  domain: "travel",
  registered: true,
  futureFieldDomain: "travel",
  variables: [
    { key: "travellers", kind: "count", source: "user" },
    { key: "nights", kind: "count", source: "user" },
    { key: "comfort_tier", kind: "enum", options: ["budget", "mid", "premium"], source: "user" },
    { key: "destination_type", kind: "enum", options: ["domestic", "regional", "longhaul"], source: "user" },
    { key: "trip_month", kind: "month", source: "user" },
    { key: "total_budget", kind: "money", source: "user" },
    { key: "monthly_contribution", kind: "money", source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "no_guardian_auto_move"],
  evidence: [
    { field: "trip_shape", source: "user" },
    { field: "reference_rates", source: "estimate" },
    { field: "monthly_free_cashflow", source: "bank" },
  ],
  nodes: ["travel", "wedding", "home", "emergency", "cashflow"],
  impacts: ["wedding", "home", "emergency", "cashflow"],
  allocationTargets: ["home", "emergency", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "allocate", "catchup"],
  behaviours: ["released_future", "decision_echo", "future_handoff"],
  replay: "change-ledger",
};

const investment = {
  domain: "investment",
  registered: true,
  futureFieldDomain: "investment",
  variables: [
    { key: "monthly_commitment", kind: "money", source: "user" },
    { key: "target_pool", kind: "money", source: "user" },
    { key: "horizon_years", kind: "count", source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "no_guardian_auto_move"],
  evidence: [
    { field: "confirmed_recurring_investment", source: "bank" },
    { field: "investment_readiness_gate", source: "reference" },
    { field: "available_monthly_cashflow", source: "bank" },
  ],
  nodes: ["investment", "emergency", "home", "retirement", "cashflow"],
  impacts: ["emergency", "home", "retirement", "cashflow"],
  allocationTargets: ["home", "emergency", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "allocate", "catchup"],
  behaviours: ["released_future", "decision_echo", "promise_weight", "future_handoff"],
  replay: "change-ledger",
};

const insurance = {
  domain: "insurance",
  registered: true,
  futureFieldDomain: "insurance",
  variables: [
    { key: "monthly_premium_now", kind: "money", source: "user" },
    { key: "income_protection_months", kind: "count", source: "user" },
    { key: "existing_income_protection", kind: "money", source: "user" },
    { key: "existing_life_cover", kind: "money", source: "user" },
    { key: "existing_ci_cover", kind: "money", source: "user" },
  ],
  constraints: ["max_monthly_contribution", "no_guardian_auto_move"],
  evidence: [
    { field: "declared_coverage", source: "user" },
    { field: "home_loan_outstanding", source: "bank" },
    { field: "term_cover_reference_rate", source: "reference" },
  ],
  nodes: ["insurance", "income", "home", "family", "care"],
  impacts: ["home", "family", "cashflow"],
  allocationTargets: ["home", "emergency", "flexible"],
  actions: ["peel", "pin", "seal"],
  behaviours: ["turning_point", "memory_lens", "promise_weight"],
  replay: "change-ledger",
};

const family = {
  domain: "family",
  registered: true,
  futureFieldDomain: "family",
  variables: [
    { key: "shared_monthly_contribution", kind: "money", source: "user" },
    { key: "partner_share_ratio", kind: "count", source: "user" },
  ],
  constraints: ["emergency_floor_months", "max_monthly_contribution", "no_balance_share", "no_guardian_auto_move"],
  evidence: [
    { field: "agreed_shared_contribution", source: "user" },
    { field: "shared_item_costs", source: "user" },
  ],
  nodes: ["family", "home", "retirement", "cashflow"],
  impacts: ["home", "retirement", "cashflow"],
  allocationTargets: ["home", "emergency", "flexible"],
  actions: ["peel", "bend", "pin", "seal", "allocate"],
  behaviours: ["turning_point", "promise_weight", "memory_lens"],
  jointConfirmation: true,
  privacy: "individual_balances_never_shared",
  replay: "change-ledger",
};

const REGISTRY = { wedding, home, emergency, loan, retirement, travel, investment, insurance, family };

// ---------------------------------------------------------------------------
// Shared Studio Contract wiring (Living Thread spec, Part B).
//
// One registry, one behaviour spine - each Studio declares which of the
// eleven contract slots it actually provides. A slot that is not built yet
// is `null` (honest), NOT a stub. This drives the completion matrix.
// ---------------------------------------------------------------------------
const STUDIO_CONTRACTS = {
  wedding: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/wedding/WeddingLivingPlan", // continuous scene alignment still pending
    financeProjector: "wedding/plan-finance#computeWeddingPlanFinance",
    crossGoalProjector: "future-field/adapters#weddingAdapter.projectImpacts",
    constraintKinds: ["min_core_guests", "emergency_floor_months", "max_monthly_contribution", "no_balance_share"],
    turningPointRules: null,
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: null,
  },
  home: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: null, // Home Horizon not built - currently the generic FutureFieldCanvas
    financeProjector: "home-finance#computeHomeFinancials",
    crossGoalProjector: null, // homeAdapter has no projectImpacts yet
    constraintKinds: ["emergency_floor_months", "max_monthly_contribution", "max_delay_months"],
    turningPointRules: null,
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: null,
  },
  emergency: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: null, // Safety Runway not built - currently the legacy NEED_EMERGENCY planner
    financeProjector: "future-field/adapters#emergencyAdapter.feasibility",
    crossGoalProjector: null,
    constraintKinds: ["emergency_floor_months", "max_monthly_contribution"],
    turningPointRules: null,
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: null,
  },
  loan: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/loan/RepaymentPath", // Debt Gravity treatment still pending
    financeProjector: "loan-finance + living-plan/monthly-shift-projection#monthsToPayoff",
    crossGoalProjector: "future-field/adapters#loanAdapter.projectImpacts",
    constraintKinds: ["emergency_floor_months", "max_monthly_contribution"],
    turningPointRules: "features/loan/RepaymentPath#loanTurningPoint",
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: null,
  },
  retirement: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/retirement/FutureLifeTimeline", // Future-Day Loom treatment still pending
    financeProjector: "future-field/adapters#retirementAdapter",
    crossGoalProjector: "future-field/adapters#retirementAdapter.projectImpacts",
    constraintKinds: ["emergency_floor_months", "max_monthly_contribution"],
    turningPointRules: null,
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: null,
  },
  travel: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/travel/TripOrbit", // Calendar Orbit treatment still pending
    financeProjector: "travel/plan-finance#computeTravelPlanFinance",
    crossGoalProjector: "future-field/adapters#travelAdapter.projectImpacts",
    constraintKinds: ["emergency_floor_months", "max_monthly_contribution"],
    turningPointRules: null,
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: null,
  },
  investment: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/investment/CapitalPaths", // Capital Prism treatment still pending
    financeProjector: "investment-readiness-finance + future-field/adapters#investmentAdapter",
    crossGoalProjector: "future-field/adapters#investmentAdapter.projectImpacts",
    constraintKinds: ["emergency_floor_months", "max_monthly_contribution"],
    turningPointRules: null,
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: null,
  },
  insurance: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/insurance/ProtectionEnvelope", // Living Envelope treatment still pending
    financeProjector: "insurance/protection-finance#computeProtectionEnvelope",
    crossGoalProjector: "future-field/adapters#insuranceAdapter.projectImpacts",
    constraintKinds: ["max_monthly_contribution"],
    turningPointRules: "features/insurance/ProtectionEnvelope#insuranceTurningPoint",
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: "insurance/protection-finance keeps unknown nodes unknown (never a gap)",
  },
  family: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/family/FamilyConstellation", // Private Constellation + real 2-participant model still pending
    financeProjector: "family/constellation-finance#computeFamilyConstellation",
    crossGoalProjector: "future-field/adapters#familyAdapter.projectImpacts",
    constraintKinds: ["no_balance_share", "emergency_floor_months", "max_monthly_contribution"],
    turningPointRules: null,
    guardianRules: "guardian/shadow-guardian (shared)",
    replayMapper: null,
    provenanceRules: null,
    unknownRules: "family/constellation-finance never returns either party's raw numbers",
  },
};

export function getStudioContract(domain) {
  return STUDIO_CONTRACTS[domain] ?? null;
}

// Contract slots this Studio has actually wired (non-null).
export function wiredContractSlots(domain) {
  const c = STUDIO_CONTRACTS[domain] ?? {};
  return Object.entries(c)
    .filter(([, v]) => v != null)
    .map(([k]) => k);
}

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
