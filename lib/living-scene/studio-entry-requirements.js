// Studio minimum entry requirements (Studio first-use fix). ONE registry
// so no 9 components hold their own empty-state logic. Each domain: what it
// solves, why the bank needs the answers, 2-3 low-friction questions (range
// chips / month / cards / slider - never a forced exact amount first), the
// first visible result, and how each answer maps onto a plan-version field
// (with provenance).
//
// Pure data + helpers. No React, no DB.

import { midpointOfRange } from "../money-input.js";

// question kinds: "range_chips" | "month" | "cards" | "slider" | "count"
export const STUDIO_ENTRY = {
  home: {
    title: "Let's shape your first home path",
    why: "FutureOS needs a rough price and timing to show when a home is within reach and what moves that date.",
    firstResult: "Your first affordability horizon and what moves it",
    questions: [
      {
        id: "price_band",
        label: "Roughly what price range are you looking at?",
        kind: "range_chips",
        field: "estimated_price",
        options: [
          { id: "under-400k", label: "Under 400k" },
          { id: "400k-600k", label: "400k–600k" },
          { id: "600k-900k", label: "600k–900k" },
          { id: "900k-1.4m", label: "900k–1.4m" },
          { id: "over-1.4m", label: "Over 1.4m" },
        ],
      },
      {
        id: "property_type",
        label: "What kind of home?",
        kind: "cards",
        field: "property_type",
        options: [
          { id: "hdb_bto", label: "HDB (BTO)" },
          { id: "hdb_resale", label: "HDB (resale)" },
          { id: "condo", label: "Condo / private" },
          { id: "ec", label: "Executive condo" },
        ],
      },
      {
        id: "target_month",
        label: "Around when would you like to buy?",
        kind: "month",
        field: "target_complete_month",
        monthsAhead: [12, 60],
      },
    ],
    exactAmountFields: [
      { id: "current_savings", label: "Savings set aside for this", field: "current_savings" },
      { id: "monthly_income", label: "Take-home monthly income", field: "monthly_income" },
    ],
    twinFallback: ["financial_assets", "income_streams"],
  },

  wedding: {
    title: "Let's shape your first wedding budget path",
    why: "A rough date and guest range lets FutureOS show a first budget and how it sits against your other goals.",
    firstResult: "Your first budget path",
    questions: [
      { id: "wedding_month", label: "Roughly which month?", kind: "month", field: "wedding_date", monthsAhead: [3, 36] },
      {
        id: "guest_band",
        label: "About how many guests?",
        kind: "range_chips",
        field: "guest_count",
        options: [
          { id: "under-40", label: "Under 40" },
          { id: "40-90", label: "40–90" },
          { id: "90-150", label: "90–150" },
          { id: "over-150", label: "Over 150" },
        ],
      },
      {
        id: "style",
        label: "What style of celebration?",
        kind: "cards",
        field: "venue_tier",
        options: [
          { id: "budget", label: "Simple / intimate" },
          { id: "mid_range", label: "Mid-range" },
          { id: "premium", label: "Premium" },
        ],
      },
    ],
    exactAmountFields: [
      { id: "monthly_contribution", label: "Amount you can save monthly", field: "monthly_contribution" },
      { id: "current_savings", label: "Savings set aside for the wedding", field: "current_savings" },
    ],
    twinFallback: ["financial_assets", "income_streams"],
  },

  emergency: {
    title: "Let's set your first safety runway",
    why: "Knowing roughly your accessible cash and essential spending lets FutureOS show how many months you're covered.",
    firstResult: "Your runway in months and a first safe-floor suggestion",
    questions: [
      {
        id: "cash_band",
        label: "Roughly how much cash could you reach quickly?",
        kind: "range_chips",
        field: "current_savings",
        options: [
          { id: "under-3k", label: "Under 3k" },
          { id: "3k-10k", label: "3k–10k" },
          { id: "10k-30k", label: "10k–30k" },
          { id: "over-30k", label: "Over 30k" },
        ],
      },
      {
        id: "essentials_band",
        label: "About how much do essentials cost each month?",
        kind: "range_chips",
        field: "monthly_expenses",
        options: [
          { id: "under-1.5k", label: "Under 1.5k" },
          { id: "1.5k-3k", label: "1.5k–3k" },
          { id: "3k-5k", label: "3k–5k" },
          { id: "over-5k", label: "Over 5k" },
        ],
      },
      {
        id: "target_months",
        label: "Months of cover you'd like",
        kind: "slider",
        field: "target_months",
        min: 1,
        max: 12,
        step: 1,
        default: 6,
      },
    ],
    exactAmountFields: [{ id: "monthly_contribution", label: "Amount you can add monthly", field: "monthly_contribution" }],
    twinFallback: ["financial_assets"],
  },

  loan: {
    title: "Let's map your first payoff path",
    why: "A rough balance and payment tells FutureOS how fast the debt clears and how much monthly room it frees.",
    firstResult: "Your repayment gravity and a first payoff date",
    questions: [
      {
        id: "balance_band",
        label: "Roughly how much is owed?",
        kind: "range_chips",
        field: "loan_amount",
        options: [
          { id: "under-5k", label: "Under 5k" },
          { id: "5k-20k", label: "5k–20k" },
          { id: "20k-50k", label: "20k–50k" },
          { id: "over-50k", label: "Over 50k" },
        ],
      },
      {
        id: "rate_band",
        label: "Roughly what interest rate?",
        kind: "cards",
        field: "annual_rate_percent",
        options: [
          { id: "low", label: "Low (~4%)" },
          { id: "mid", label: "Mid (~12%)" },
          { id: "high", label: "High (~24%)" },
          { id: "not_sure", label: "Not sure" },
        ],
      },
      {
        id: "min_payment_band",
        label: "Roughly the minimum monthly payment?",
        kind: "range_chips",
        field: "monthly_installment",
        options: [
          { id: "under-100", label: "Under 100" },
          { id: "100-300", label: "100–300" },
          { id: "300-700", label: "300–700" },
          { id: "over-700", label: "Over 700" },
        ],
      },
    ],
    exactAmountFields: [
      { id: "monthly_installment", label: "Exact minimum monthly payment", field: "monthly_installment" },
      { id: "extra_repayment", label: "Extra you could pay monthly", field: "extra_repayment" },
    ],
    twinFallback: ["liabilities"],
  },

  retirement: {
    title: "Let's sketch your first future-income path",
    why: "An age band and rough income lets FutureOS estimate the future gap and a first contribution pace.",
    firstResult: "Your future income gap and a first contribution path",
    questions: [
      {
        id: "age_band",
        label: "Roughly your age now",
        kind: "cards",
        field: "current_age",
        options: [
          { id: "20s", label: "20s" },
          { id: "30s", label: "30s" },
          { id: "40s", label: "40s" },
          { id: "50s", label: "50s" },
          { id: "60plus", label: "60+" },
        ],
      },
      {
        id: "income_band",
        label: "Roughly your monthly income now",
        kind: "range_chips",
        field: "monthly_income",
        options: [
          { id: "under-3k", label: "Under 3k" },
          { id: "3k-6k", label: "3k–6k" },
          { id: "6k-10k", label: "6k–10k" },
          { id: "over-10k", label: "Over 10k" },
        ],
      },
      {
        id: "future_income_band",
        label: "Monthly income you'd want in retirement",
        kind: "range_chips",
        field: "target_monthly_income",
        options: [
          { id: "under-2k", label: "Under 2k" },
          { id: "2k-4k", label: "2k–4k" },
          { id: "4k-7k", label: "4k–7k" },
          { id: "over-7k", label: "Over 7k" },
        ],
      },
    ],
    exactAmountFields: [
      { id: "current_savings", label: "Retirement savings so far", field: "current_savings" },
      { id: "monthly_contribution", label: "Amount you can contribute monthly", field: "monthly_contribution" },
    ],
    twinFallback: ["financial_assets", "income_streams"],
  },

  travel: {
    title: "Let's plan your first trip budget window",
    why: "Distance, timing and party size let FutureOS show a first trip budget and the monthly pace to reach it.",
    firstResult: "Your trip budget window and a monthly path",
    questions: [
      {
        id: "distance_band",
        label: "How far are you going?",
        kind: "cards",
        field: "destination_type",
        options: [
          { id: "local", label: "Local / staycation" },
          { id: "regional", label: "Regional (SE Asia)" },
          { id: "long_haul", label: "Long-haul" },
        ],
      },
      { id: "trip_month", label: "Roughly which month?", kind: "month", field: "trip_month", monthsAhead: [2, 24] },
      { id: "travellers", label: "How many travelling?", kind: "count", field: "travellers", min: 1, max: 8, default: 2 },
    ],
    exactAmountFields: [
      { id: "monthly_contribution", label: "Amount you can save monthly", field: "monthly_contribution" },
      { id: "current_savings", label: "Savings set aside for the trip", field: "current_savings" },
    ],
    twinFallback: ["financial_assets", "income_streams"],
  },

  investment: {
    title: "Let's shape your first allocation preview",
    why: "A monthly amount, horizon and risk comfort lets FutureOS show an education-only allocation preview. It never places a trade.",
    firstResult: "An allocation preview — planning information only, no execution",
    questions: [
      {
        id: "monthly_band",
        label: "Amount you're comfortable reserving monthly",
        kind: "range_chips",
        field: "monthly_investment",
        options: [
          { id: "under-200", label: "Under 200" },
          { id: "200-500", label: "200–500" },
          { id: "500-1.5k", label: "500–1,500" },
          { id: "over-1.5k", label: "Over 1,500" },
        ],
      },
      {
        id: "horizon",
        label: "How long could this stay invested?",
        kind: "cards",
        field: "liquidity_gate_years",
        options: [
          { id: "1", label: "~1 year" },
          { id: "3", label: "~3 years" },
          { id: "7", label: "~7 years" },
          { id: "15", label: "15+ years" },
        ],
      },
      {
        id: "risk",
        label: "Risk comfort",
        kind: "cards",
        field: "risk_preference",
        options: [
          { id: "cautious", label: "Cautious" },
          { id: "balanced", label: "Balanced" },
          { id: "adventurous", label: "Adventurous" },
        ],
      },
    ],
    exactAmountFields: [{ id: "current_savings", label: "Capital available to invest", field: "current_savings" }],
    twinFallback: ["financial_assets"],
    disclaimer: "Planning information / education only. Not investment advice. No trade is ever executed.",
  },

  insurance: {
    title: "Let's sketch your first protection gap",
    why: "Who relies on your income, and roughly how much it is, lets FutureOS show a protection-gap estimate. It is not a quote or an approval.",
    firstResult: "A protection gap preview — not a quote or underwriting",
    questions: [
      { id: "dependents", label: "How many people rely on your income?", kind: "count", field: "dependents", min: 0, max: 8, default: 0 },
      {
        id: "income_band",
        label: "Roughly your monthly income",
        kind: "range_chips",
        field: "monthly_income",
        options: [
          { id: "under-3k", label: "Under 3k" },
          { id: "3k-6k", label: "3k–6k" },
          { id: "6k-10k", label: "6k–10k" },
          { id: "over-10k", label: "Over 10k" },
        ],
      },
      {
        id: "priority",
        label: "What matters most to protect?",
        kind: "cards",
        field: "protection_priority",
        options: [
          { id: "income", label: "Income replacement" },
          { id: "critical_illness", label: "Critical illness" },
          { id: "family_debt", label: "Family & debts" },
        ],
      },
    ],
    exactAmountFields: [
      { id: "existing_life_cover", label: "Existing life cover", field: "existing_life_cover" },
      { id: "monthly_premium_now", label: "Premiums you pay now monthly", field: "monthly_premium_now" },
    ],
    twinFallback: ["income_streams", "liabilities"],
    disclaimer: "Estimate only. A licensed provider must confirm any cover, premium or approval.",
  },

  family: {
    title: "Let's map your first shared responsibility path",
    why: "Household size and a rough shared monthly amount lets FutureOS show a shared buffer path. Private balances are never shown to others.",
    firstResult: "A shared buffer / responsibility path",
    questions: [
      { id: "household", label: "People in the shared household", kind: "count", field: "household_size", min: 2, max: 8, default: 2 },
      {
        id: "shared_band",
        label: "Rough shared monthly responsibility",
        kind: "range_chips",
        field: "shared_monthly_contribution",
        options: [
          { id: "under-500", label: "Under 500" },
          { id: "500-1.5k", label: "500–1,500" },
          { id: "1.5k-3k", label: "1,500–3,000" },
          { id: "over-3k", label: "Over 3,000" },
        ],
      },
      {
        id: "visibility",
        label: "Default visibility with the other person",
        kind: "cards",
        field: "visibility_preference",
        options: [
          { id: "bands_only", label: "Shared bands only" },
          { id: "agreed_items", label: "Agreed items" },
          { id: "full", label: "Full (both opt in)" },
        ],
      },
    ],
    exactAmountFields: [{ id: "shared_monthly_contribution", label: "Exact shared monthly amount", field: "shared_monthly_contribution" }],
    twinFallback: ["income_streams"],
  },
};

export const ENTRY_DOMAINS = Object.keys(STUDIO_ENTRY);

export function getEntryRequirements(domain) {
  return STUDIO_ENTRY[domain] ?? null;
}

// Card / band ids -> the numeric or string value written onto the plan
// version. Non-range cards use an explicit map; range chips use a midpoint.
const CARD_VALUE = {
  // home
  hdb_bto: "hdb_bto", hdb_resale: "hdb_resale", condo: "condo", ec: "ec",
  // wedding
  budget: "budget", mid_range: "mid_range", premium: "premium",
  // loan rate
  low: 4, mid: 12, high: 24, not_sure: null,
  // retirement age band
  "20s": 25, "30s": 35, "40s": 45, "50s": 55, "60plus": 63,
  // travel distance
  local: "local", regional: "regional", long_haul: "long_haul",
  // investment horizon (years) handled by parseInt fallback below
  cautious: "cautious", balanced: "balanced", adventurous: "adventurous",
  income: "income", critical_illness: "critical_illness", family_debt: "family_debt",
  bands_only: "bands_only", agreed_items: "agreed_items", full: "full",
};

function valueForAnswer(q, answerId) {
  if (answerId == null || answerId === "") return { value: null };
  if (q.kind === "range_chips") {
    const mid = midpointOfRange(answerId);
    return mid ? { value: mid.value, range: { low: mid.low, high: mid.high }, provenance: "user_range" } : { value: null };
  }
  if (q.kind === "slider" || q.kind === "count") {
    const n = Number(answerId);
    return Number.isFinite(n) ? { value: n, provenance: "user_confirmed" } : { value: null };
  }
  if (q.kind === "month") return { value: String(answerId), provenance: "user_confirmed" };
  if (q.kind === "cards") {
    if (answerId in CARD_VALUE) return { value: CARD_VALUE[answerId], provenance: "user_confirmed" };
    const n = parseInt(answerId, 10);
    return Number.isFinite(n) ? { value: n, provenance: "user_confirmed" } : { value: answerId, provenance: "user_confirmed" };
  }
  return { value: answerId, provenance: "user_confirmed" };
}

// answers: { [questionId]: answerId }  (+ optional exactAmounts: { field: number })
// -> { patch: {field:value}, provenance: {field: "user_range"|"user_confirmed"|"system_estimate"}, missing: [questionId] }
export function buildSeedPatch(domain, answers = {}, { exactAmounts = {}, mode = "confirmed" } = {}) {
  const req = getEntryRequirements(domain);
  if (!req) return { error: "unknown_domain" };
  const patch = {};
  const provenance = {};
  const missing = [];

  for (const q of req.questions) {
    const raw = answers[q.id];
    if (raw == null || raw === "") {
      if (mode === "confirmed") missing.push(q.id);
      // in estimate mode, fill a neutral default so a path can still render
      if (mode === "estimate") {
        const def = q.default ?? (q.kind === "range_chips" ? q.options?.[1]?.id : q.options?.[0]?.id);
        if (def != null) {
          const v = valueForAnswer(q, def);
          if (v.value != null) {
            patch[q.field] = v.value;
            provenance[q.field] = "system_estimate";
          }
        }
      }
      continue;
    }
    const v = valueForAnswer(q, raw);
    if (v.value != null) {
      patch[q.field] = v.value;
      provenance[q.field] = mode === "estimate" ? "system_estimate" : v.provenance ?? "user_confirmed";
      if (v.range) patch[`${q.field}__range`] = v.range;
    }
  }

  // exact amounts always override with user_confirmed provenance
  for (const [field, amount] of Object.entries(exactAmounts)) {
    const n = Number(amount);
    if (Number.isFinite(n)) {
      patch[field] = n;
      provenance[field] = "user_confirmed";
    }
  }

  return { patch, provenance, missing, mode };
}
