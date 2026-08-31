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
    { key: "down_payment_ratio", kind: "ratio", source: "user" },
    { key: "loan_tenure", kind: "count", source: "user" },
    { key: "rate_assumption", kind: "percent", source: "assumption" },
    { key: "renovation_reserve", kind: "money", source: "user" },
    { key: "keep_emergency_months", kind: "count", source: "user" },
    { key: "partner_contribution", kind: "money", source: "user_authorised" },
  ],
  constraints: [
    "minimum_emergency_months",
    "maximum_monthly_repayment",
    "minimum_renovation_reserve",
    "latest_purchase_month",
    "no_partner_share",
    "minimum_post_purchase_cash",
    "no_guardian_auto_move",
  ],
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
    { key: "protected_commitments", kind: "id_list", source: "user" },
    { key: "essential_share", kind: "ratio", source: "user" },
  ],
  constraints: ["minimum_floor_months", "maximum_rebuild_monthly", "no_goal_funding_below_floor", "no_guardian_auto_move"],
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
    { key: "one_off_payment", kind: "money", source: "user" },
    { key: "target_debt", kind: "id", source: "user" },
    { key: "breathing_room_floor", kind: "money", source: "user" },
    { key: "repayment_strategy", kind: "enum", options: ["highest_rate_first", "smallest_balance_first", "balanced"], source: "user" },
    { key: "excluded_debt_ids", kind: "id_list", source: "user" },
  ],
  constraints: ["minimum_breathing_room", "maximum_extra_payment", "protect_emergency_floor", "no_one_off_from_protected_savings", "target_debt_only", "no_guardian_auto_move"],
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
    { key: "future_day", kind: "choice_set", source: "user" },
    { key: "future_age", kind: "count", source: "user" },
    { key: "inflation_assumption", kind: "percent", source: "assumption" },
    { key: "longevity_years", kind: "count", source: "assumption" },
    { key: "real_return_assumption", kind: "percent", source: "assumption" },
    { key: "minimum_current_breathing_room", kind: "money", source: "user" },
  ],
  constraints: ["minimum_current_breathing_room", "minimum_emergency_floor", "maximum_monthly_contribution", "protected_future_day_choices", "no_assumed_inheritance", "no_unconfirmed_partner_assets", "no_guardian_auto_move"],
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
    { key: "latest_trip_month", kind: "month", source: "user" },
    { key: "minimum_current_breathing_room", kind: "money", source: "user" },
  ],
  constraints: ["minimum_current_breathing_room", "minimum_emergency_floor", "maximum_monthly_contribution", "latest_trip_month", "no_trip_funding_below_emergency_floor", "no_guardian_auto_move"],
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
    { key: "jobs", kind: "split_set", source: "user" },
    { key: "liquidity_gate_years", kind: "count", source: "user" },
    { key: "target_pool", kind: "money", source: "user" },
    { key: "horizon_years", kind: "count", source: "user" },
    { key: "real_return_assumption", kind: "percent", source: "assumption" },
  ],
  constraints: ["minimum_emergency_floor", "minimum_liquid_capital", "minimum_flexible_capital", "maximum_monthly_contribution", "no_investing_below_readiness_gate", "no_guardian_auto_move"],
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
    { key: "desired_cover", kind: "cover_set", source: "user" },
  ],
  constraints: ["minimum_current_breathing_room", "maximum_monthly_contribution", "minimum_income_protection_months", "no_underwriting_or_quote", "no_unknown_counted_as_gap", "no_guardian_auto_move"],
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
    { key: "minimum_current_breathing_room", kind: "money", source: "user" },
  ],
  constraints: ["minimum_current_breathing_room", "maximum_monthly_contribution", "minimum_confirmations", "no_balance_share", "no_partner_data_in_viewer_response", "no_guardian_auto_move"],
  participants: 2,
  privacyModel: "two_independent_identities",
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
    nativeScene: "features/wedding/WeddingLivingPlan", // aligned to the shared contract (Living Thread commit 10)
    financeProjector: "wedding/plan-finance#computeWeddingPlanFinance",
    crossGoalProjector: "wedding/wedding-thread-projector#projectWeddingThreadImpact",
    constraintKinds: ["min_core_guests", "emergency_floor_months", "max_monthly_contribution", "no_balance_share"],
    turningPointRules: "api/wedding-thread#weddingTurningPoints (budget gap / behind pace)",
    guardianRules: "watches contribution + reference-rate freshness + vendor deposits; never auto-books a vendor / transfers / reveals partner savings",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "wedding/plan-finance is a Singapore reference-rate estimate, never a vendor quote; partner's earmarked savings stay private",
    unknownRules: "guest count / wedding date stay unknown unless provided; partner's earmarked savings are never returned",
  },
  home: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/home/HomeHorizon", // Home Horizon (Living Thread commit 2)
    financeProjector: "home/horizon-finance#computeHomeHorizon",
    crossGoalProjector: "home/horizon-projector#projectHomeImpact",
    constraintKinds: [
      "minimum_emergency_months",
      "maximum_monthly_repayment",
      "minimum_renovation_reserve",
      "latest_purchase_month",
      "no_partner_share",
      "minimum_post_purchase_cash",
    ],
    turningPointRules: "features/home/HomeHorizon#homeTurningPoint + api/home-horizon#homeTurningPoints",
    guardianRules: "watches deposit progress + rate-assumption freshness + emergency rail; never applies for a loan / transfers / picks a property",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "home/horizon-finance attaches bank_confirmed | user_confirmed | system_estimate | unknown to every figure",
    unknownRules: "CPF and partner contribution are unknown unless explicitly confirmed / authorised; never counted, never defaulted",
  },
  emergency: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/emergency/EmergencyRunway", // Safety Runway (Living Thread commit 3)
    financeProjector: "emergency/runway-finance#computeSafetyRunway + rehearseShock",
    crossGoalProjector: "emergency/runway-projector#projectRunwayImpact",
    constraintKinds: ["minimum_floor_months", "maximum_rebuild_monthly", "no_goal_funding_below_floor"],
    turningPointRules: "features/emergency/EmergencyRunway#emergencyTurningPoint + api/emergency-runway#runwayTurningPoints",
    guardianRules: "watches buffer crossing + real income/expense changes + new commitments; never auto-pauses / auto-transfers / auto-rehearses",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "runway-finance attaches bank_confirmed | user_confirmed | system_estimate | unknown to every figure; liquid assets and essential share are fog when unknown",
    unknownRules: "monthly expenses and liquid assets stay unknown (fog) - the runway is not computed and never drawn as a risk fact",
  },
  loan: {
    realityLoader: "future-field/service#loadDomainContext + api/debt-gravity assembles all confirmed debts",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/loan/DebtGravity", // Debt Gravity (Living Thread commit 4)
    financeProjector: "loan/debt-gravity-finance#computeDebtGravity + amortize + strategyComparison",
    crossGoalProjector: "loan/debt-gravity-projector#projectDebtImpact",
    constraintKinds: ["minimum_breathing_room", "maximum_extra_payment", "protect_emergency_floor", "no_one_off_from_protected_savings", "target_debt_only"],
    turningPointRules: "features/loan/DebtGravity#loanGravityTurningPoint + api/debt-gravity#gravityTurningPoints",
    guardianRules: "watches due dates + breathing-room floor; proposes a Future Handoff at payoff; never auto-repays / auto-selects a debt / auto-redistributes the released monthly",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "debt-gravity-finance attaches bank_confirmed | user_confirmed | system_estimate | unknown to every figure; unknown APR / early-repayment fees stay unknown, never 0",
    unknownRules: "APR and early-repayment fees are unknown unless confirmed - never assumed 0",
  },
  retirement: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/retirement/FutureDayLoom", // Future-Day Loom (Living Thread commit 5)
    financeProjector: "retirement/future-day-finance#computeFutureLoom + buildFutureDay",
    crossGoalProjector: "retirement/future-day-projector#projectFutureDayImpact",
    constraintKinds: ["minimum_current_breathing_room", "minimum_emergency_floor", "maximum_monthly_contribution", "protected_future_day_choices", "no_assumed_inheritance", "no_unconfirmed_partner_assets"],
    turningPointRules: "features/retirement/FutureDayLoom#loomTurningPoint + api/future-day-loom#loomTurningPoints (liquidity conflict / breathing floor / gap threshold)",
    guardianRules: "watches contribution + Life Thread changes; alerts when assumptions expire; never auto-increases the contribution / executes trades / treats a Decision Echo as authorization",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "future-day-finance attaches bank_confirmed | user_confirmed | system_estimate | unknown; the projection assumes NO investment return in its base; any optimistic band carries a stated, dated return assumption",
    unknownRules: "CPF LIFE payout, existing retirement assets, current age and expenses stay unknown unless confirmed; no inheritance and no unconfirmed partner assets are ever counted",
  },
  travel: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/travel/CalendarOrbit", // Calendar Orbit (Living Thread commit 6)
    financeProjector: "travel/calendar-orbit-finance#computeCalendarOrbit + requiredMonthlyForTripMonth",
    crossGoalProjector: "travel/calendar-orbit-projector#projectCalendarOrbitImpact",
    constraintKinds: ["minimum_current_breathing_room", "minimum_emergency_floor", "maximum_monthly_contribution", "latest_trip_month", "no_trip_funding_below_emergency_floor"],
    turningPointRules: "features/travel/CalendarOrbit#orbitTurningPoint + api/calendar-orbit#orbitTurningPoints (liquidity conflict / breathing floor / trip slips past pin / behind pace)",
    guardianRules: "watches payment windows + fare-assumption freshness + contribution; never books / transfers / moves the trip month",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "calendar-orbit-finance attaches bank_confirmed | user_confirmed | system_estimate | unknown to every figure; seasonality is a transparent multiplier, never buried; fares are reference rates, never a prediction",
    unknownRules: "trip month, earmarked savings and monthly income stay unknown (fog) unless confirmed - the funding pace is not computed and never drawn as a risk fact",
  },
  investment: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/investment/CapitalPrism", // Capital Prism (Living Thread commit 7)
    financeProjector: "investment/capital-prism-finance#computeCapitalPrism + requiredInvestingForTargetYears",
    crossGoalProjector: "investment/capital-prism-projector#projectCapitalPrismImpact",
    constraintKinds: ["minimum_emergency_floor", "minimum_liquid_capital", "minimum_flexible_capital", "maximum_monthly_contribution", "no_investing_below_readiness_gate"],
    turningPointRules: "features/investment/CapitalPrism#prismTurningPoint + api/capital-prism#prismTurningPoints (over-allocated / readiness gate blocks locked bands)",
    guardianRules: "watches contribution + readiness gate + liquidity gate; never executes trades / auto-rebalances / auto-increases the commitment / treats a liquidity split as authorization",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "capital-prism-finance attaches bank_confirmed | user_confirmed | system_estimate | unknown to every figure; the base assumes NO investment return; any optimistic band carries a stated, dated return assumption shown separately",
    unknownRules: "available monthly cashflow, current savings and credit-card outstanding stay unknown unless confirmed - the capital pool is fog, not computed as 0",
  },
  insurance: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/insurance/LivingEnvelope", // Living Envelope (Living Thread commit 8)
    financeProjector: "insurance/living-envelope-finance#computeLivingEnvelope + requiredPremiumForCover",
    crossGoalProjector: "insurance/living-envelope-projector#projectLivingEnvelopeImpact",
    constraintKinds: ["minimum_current_breathing_room", "maximum_monthly_contribution", "minimum_income_protection_months", "no_underwriting_or_quote", "no_unknown_counted_as_gap"],
    turningPointRules: "features/insurance/LivingEnvelope#envelopeTurningPoint + api/living-envelope#envelopeTurningPoints (liquidity conflict / breathing floor / income floor / open exposure)",
    guardianRules: "watches premium + declared-coverage freshness + Life Thread changes; never buys a policy / runs underwriting / auto-increases the premium / shares health data",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "living-envelope-finance attaches user_confirmed | system_estimate | unknown to every figure; premium is a reference rate, never a quote; no underwriting is ever run",
    unknownRules: "an Unknown life node is shown as unknown and never counted as a gap; the membrane simply skips it",
  },
  family: {
    realityLoader: "future-field/service#loadDomainContext",
    branchVariables: "registry#<domain>.variables",
    nativeScene: "features/family/PrivateConstellation", // Private Constellation (Living Thread commit 9)
    financeProjector: "family/private-constellation-finance#computePrivateConstellation + sharedContributionForViewerShare",
    crossGoalProjector: "family/private-constellation-projector#projectPrivateConstellationImpact",
    constraintKinds: ["minimum_current_breathing_room", "maximum_monthly_contribution", "minimum_confirmations", "no_balance_share", "no_partner_data_in_viewer_response"],
    turningPointRules: "features/family/PrivateConstellation#constellationTurningPoint + api/private-constellation#constellationTurningPoints (awaiting partner / awaiting confirmations / conflicts / liquidity)",
    guardianRules: "watches shared contribution + both confirmations + Life Thread changes; never reveals partner balances / confirms on behalf of a partner / auto-moves shared money / merges without both confirmations",
    replayMapper: "living-plan/memory-scrub#buildMemoryScrub + components/living-scene/ThreadMemoryScrubber (Before/After over real plan_versions)",
    provenanceRules: "private-constellation-finance attaches user_confirmed | system_estimate | unknown; the viewer's own share is user_confirmed; the partner's numbers are never returned",
    unknownRules: "two INDEPENDENT identities (family_participants table) - neither can read the other's affordability numbers or per-item marks; nothing seals until both have joined and confirmed separately",
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
