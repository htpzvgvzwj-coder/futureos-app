// One coherent example dataset for a single account, so every tab and
// every feature has something real to work with the moment you open it:
// accounts + ~90 days of categorised transactions, income, bills, CPF + an
// investment, a small card balance, five Studio plans with active monthly
// commitments, the three outside-data links, and a Care Circle row.
//
// Every figure written here is source_type 'synthetic_fixture' (or
// 'government_linked' where a real SGFinDex link stands behind it) — never
// presented as a bank fact. `buildSampleAccount` is idempotent: it wipes
// this one account's data first, then rebuilds.
//
// Used by scripts/seed-demo.mjs (a named demo login) and by
// POST /api/account/sample-data (any signed-in account, from Settings).

import { query } from "../db.js";
import { setAccountType, setConsent, advanceOnboarding, grantRole } from "../account-control/store.js";
import { createBankAccount } from "../bank/accounts-store.js";
import { createAsset } from "../asset-store.js";
import { appendTransaction } from "../transaction-ledger/store.js";
import { createFinancialAsset, createLiability, createIncomeStream, upsertRecurringObligation } from "../financial-twin/rows-store.js";
import { createCommitment } from "../goal-commitment-store.js";
import { planStore } from "../plan-runtime/index.js";
import { connectProvider } from "../connections/store.js";
import { savePreferences } from "../preferences-store.js";
import { recordEventSafe } from "../change-ledger/store.js";
import { setBirthYear } from "../care/transitions.js";
import { createAuthRequest } from "../authorization/store.js";

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const thisMonth = () => new Date().toISOString().slice(0, 7);
const due = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const OWNED = [
  "bank_transactions", "import_batches", "financial_assets", "liabilities", "income_streams",
  "recurring_obligations", "ripple_events", "change_ledger_events", "money_moment_state",
  "goal_commitments", "bank_accounts", "consent_records", "lifecycle_roles", "care_handoff_plans",
  "authorization_requests", "authorization_policies", "guardian_contracts", "care_shared_ranges",
  "care_transitions", "care_nudges", "care_invites", "audit_events", "user_onboarding",
  "user_preferences", "assets", "provider_connections", "life_thread_snapshots",
];

export async function wipeSampleAccount(uid) {
  for (const t of OWNED) {
    await query(`delete from ${t} where profile_key = $1`, [uid]).catch(() => {});
  }
  const plans = await query(`select id from plans where profile_key = $1`, [uid]).catch(() => ({ rows: [] }));
  for (const p of plans.rows) {
    await query(`delete from plan_branches where plan_id = $1`, [p.id]).catch(() => {});
    await query(`delete from plan_versions where plan_id = $1`, [p.id]).catch(() => {});
  }
  await query(`delete from plans where profile_key = $1`, [uid]).catch(() => {});
}

// A funded Singapore individual: SGD 7,500/month in, SGD 3,600 essential
// living, so SGD 3,900 is spendable after living costs. Wedding (2028) and
// Home (2031) each carry an active monthly commitment (1,000 + 1,500), so
// SGD 1,400/month is still flexible. ~SGD 85k in an emergency-purpose
// balance is a 23.6-month safety buffer against 3,600/month of essentials.
// A SGD 2,400 card statement falls due before the next salary.
// Every figure here is source_type 'synthetic_fixture'; all downstream
// numbers (impacts, History, Guardian) are computed by the real engine.
const INCOME = 7500;
const ESSENTIAL = 3600;
const SAVINGS_BAL = 80000; // emergency-purpose; with Everyday -> ~23.6 months of essentials
const EVERYDAY_BAL = 5000;
const CPF_OA = 52000;
const CPF_SA = 28000;
const FUND = 6000;
const CARD_BAL = 2400;

export async function buildSampleAccount(uid, { wipeFirst = true } = {}) {
  if (wipeFirst) await wipeSampleAccount(uid);

  // profile — Life Thread + Guardian read stated income / expenses / savings from here
  await savePreferences(uid, {
    profileVersion: 3,
    profile: { statedMonthlyIncome: INCOME, monthlyExpenses: ESSENTIAL, currentSavings: EVERYDAY_BAL + SAVINGS_BAL, creditCardOutstanding: CARD_BAL },
  });

  // onboarding
  await setAccountType(uid, "individual");
  for (const scope of ["account_data", "transaction_data", "assets_liabilities", "planning_data"]) {
    await setConsent(uid, scope, true);
  }
  for (const step of ["add_reality", "first_result", "complete"]) await advanceOnboarding(uid, step);

  // accounts
  const everyday = (await createBankAccount(uid, { kind: "current", displayName: "Everyday", institution: "OCBC", currency: "SGD", sourceType: "synthetic_fixture" })).id;
  const savings = (await createBankAccount(uid, { kind: "savings", displayName: "Savings", institution: "OCBC", currency: "SGD", sourceType: "synthetic_fixture" })).id;
  const card = (await createBankAccount(uid, { kind: "credit_card", displayName: "365 Credit Card", institution: "OCBC", currency: "SGD", creditLimit: 12000, sourceType: "synthetic_fixture" })).id;

  // Collect every transaction, then write in parallel batches — a fresh
  // account's ledger is append-only so order doesn't matter, and this
  // keeps the whole build inside a serverless function's time budget.
  const txns = [];
  const tx = (accountId, direction, amount, daysAgo, category, merchant, channel = "card") =>
    txns.push({
      accountId, direction, amount, status: "posted", category, merchant, channel,
      postedAt: iso(daysAgo), authorisedAt: iso(daysAgo), sourceType: "synthetic_fixture",
    });

  tx(everyday, "credit", 3000, 95, "other", "Opening balance", "opening_balance");
  tx(savings, "credit", 79100, 95, "other", "Opening balance", "opening_balance");

  for (const d of [92, 61, 31, 2]) {
    tx(everyday, "credit", INCOME, d, "transfer", "ACME PTE LTD — SALARY", "salary");
    tx(everyday, "debit", 300, d - 1, "transfer", "Monthly transfer to Savings", "transfer");
    tx(savings, "credit", 300, d - 1, "transfer", "From Everyday — monthly", "transfer");
  }

  const bills = [
    ["housing", "Rent — S. Tan (landlord)", 2000],
    ["food", "FairPrice — weekly groceries", 480],
    ["transport", "SimplyGo auto top-up", 180],
    ["utilities", "SP Group", 140],
    ["utilities", "Singtel Mobile", 42],
    ["utilities", "MyRepublic Broadband", 45],
    ["health", "Anytime Fitness", 70],
    ["entertainment", "Netflix", 20],
    ["entertainment", "Spotify", 12],
  ];
  for (const [cat, merchant, amt] of bills) {
    for (const d of [84, 54, 24]) tx(everyday, "debit", amt, d, cat, merchant, "giro");
  }

  const daily = [
    ["food", "FairPrice", 8, [72, 118]],
    ["food", "Kopitiam / hawker", 12, [4, 16]],
    ["food", "Cafe / restaurant", 6, [22, 48]],
    ["transport", "SimplyGo", 10, [3, 9]],
    ["transport", "Grab", 4, [14, 26]],
    ["shopping", "Uniqlo / Muji / Shopee", 5, [35, 120]],
    ["health", "Guardian / Watsons", 4, [12, 34]],
    ["entertainment", "Golden Village / events", 3, [16, 30]],
  ];
  let seedN = 7;
  const rnd = () => ((seedN = (seedN * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const [cat, merchant, count, [lo, hi]] of daily) {
    for (let i = 0; i < count; i++) {
      const day = Math.round(2 + (88 * i) / Math.max(1, count - 1) + (rnd() * 6 - 3));
      const amt = Math.round(lo + rnd() * (hi - lo));
      tx(card, "debit", amt, Math.max(1, Math.min(89, day)), cat, merchant, "card");
    }
  }
  for (const d of [70, 40, 10]) {
    tx(everyday, "debit", 640, d, "transfer", "Credit card payment", "card_repayment");
    tx(card, "credit", 640, d, "transfer", "Payment received — thank you", "card_repayment");
  }

  for (let i = 0; i < txns.length; i += 12) {
    await Promise.all(txns.slice(i, i + 12).map((t) => appendTransaction(uid, t)));
  }

  // income stream + recurring obligations
  const next = new Date();
  next.setDate(next.getDate() + 9);
  await createIncomeStream(uid, {
    label: "ACME salary", kind: "salary", monthlyAmount: INCOME, payDayOfMonth: next.getDate(),
    nextExpectedDate: next.toISOString().slice(0, 10), detectedFromAccountId: everyday, sourceType: "synthetic_fixture",
  });
  const obs = [
    ["Rent", "bill", "S. Tan", 2000, "housing", "rent", 4],
    ["Groceries", "bill", "FairPrice", 480, "food", "groceries", 7],
    ["Transport", "bill", "SimplyGo", 180, "transport", "transport", 5],
    ["Electricity & water", "bill", "SP Group", 140, "utilities", "sp", 12],
    ["Mobile", "bill", "Singtel", 42, "utilities", "mobile", 6],
    ["Broadband", "bill", "MyRepublic", 45, "utilities", "broadband", 9],
    ["Gym", "subscription", "Anytime Fitness", 70, "health", "gym", 2],
    ["Netflix", "subscription", "Netflix", 20, "entertainment", "netflix", 15],
    ["Spotify", "subscription", "Spotify", 12, "entertainment", "spotify", 17],
  ];
  for (const [label, kind, merchant, amt, category, group, n] of obs) {
    await upsertRecurringObligation(uid, {
      label, kind, merchant, monthlyAmount: amt, cadence: "monthly", nextDueDate: due(n),
      category, recurringGroup: group, sourceType: "synthetic_fixture",
    });
  }
  // Non-monthly charges — the Pressure Weather forecast finds the month
  // where these land together. `monthlyAmount` here is the lump on the due
  // date (read that way when cadence != monthly).
  const lumps = [
    ["Insurance premium (annual)", "bill", "Great Eastern", 936, "insurance", "annual", 62],
    ["Town council special levy", "bill", "Town Council", 280, "housing", "annual", 68],
    ["Wedding venue deposit", "bill", "The Venue", 3000, "wedding", "one_off", 66],
  ];
  for (const [label, kind, merchant, amt, category, cadence, n] of lumps) {
    await upsertRecurringObligation(uid, {
      label, kind, merchant, monthlyAmount: amt, cadence, nextDueDate: due(n),
      category, recurringGroup: `${category}-${cadence}`, sourceType: "synthetic_fixture",
    });
  }

  // Financial Twin ledger + Asset Profile (read by different parts; keep in step)
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Everyday", linkedAccountId: everyday, currentValue: EVERYDAY_BAL, liquidityClass: "cash", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Savings (emergency fund)", linkedAccountId: savings, currentValue: SAVINGS_BAL, liquidityClass: "near_cash", restrictedPurpose: "emergency", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "cpf_oa", label: "CPF Ordinary Account", currentValue: CPF_OA, liquidityClass: "restricted", restrictedPurpose: "housing", sourceType: "government_linked", sourceName: "SGFinDex", confidence: "high" });
  await createFinancialAsset(uid, { assetClass: "cpf_sa_ra", label: "CPF Special Account", currentValue: CPF_SA, liquidityClass: "restricted", restrictedPurpose: "retirement", sourceType: "government_linked", sourceName: "SGFinDex", confidence: "high" });
  await createFinancialAsset(uid, { assetClass: "investment", label: "Global equity index fund", currentValue: FUND, liquidityClass: "liquid", sourceType: "synthetic_fixture", confidence: "low" });
  // statement due before the next salary lands (income arrives in ~9 days)
  await createLiability(uid, { liabilityClass: "credit_card_statement", label: "365 Credit Card", linkedAccountId: card, currentBalance: CARD_BAL, apr: 26.8, minimumMonthly: 120, nextDueDate: due(5), sourceType: "synthetic_fixture" });

  await createAsset(uid, { category: "financial", subtype: "checking_deposit", name: "OCBC Everyday", value: EVERYDAY_BAL, details: { liquidity: "cash" } });
  await createAsset(uid, { category: "financial", subtype: "cash", name: "OCBC Savings", value: SAVINGS_BAL, details: { liquidity: "near_cash" } });
  await createAsset(uid, { category: "financial", subtype: "fund", name: "Global equity index fund", value: FUND, details: { liquidity: "illiquid", risk: "medium" } });
  await createAsset(uid, { category: "financial", subtype: "pension", name: "CPF (OA + SA)", value: CPF_OA + CPF_SA, details: { liquidity: "illiquid" } });
  await createAsset(uid, { category: "legal", subtype: "insurance_policy", name: "Term life + CI (Great Eastern)", value: null, details: { status: "active", coverage: 250000, kind: "term_life_ci", premiumMonthly: 78 } });

  // the three outside-data links
  for (const provider of ["sgfindex", "insurer", "payment_provider"]) {
    await connectProvider(uid, provider).catch(() => {});
  }

  // five Studio plans + active monthly commitments (covers every Explore
  // capability zone and every Life node that can be pulled)
  const seedPlan = async (domain, title, patch, monthly) => {
    const plan = await planStore.getOrCreatePlan(uid, { domain, goalKey: domain, title });
    const versions = await planStore.listPlanVersions(plan.id);
    if (versions.length === 0) {
      await planStore.appendPlanVersion(plan.id, uid, { patch, cause: { trigger: "sample_data" }, actor: "system" });
    }
    if (monthly) {
      await createCommitment(uid, {
        domain, monthlyContribution: monthly, effectiveMonth: thisMonth(),
        pauseIfEmergencyMonthsBelow: 3, sourceMoment: { trigger: "sample_data" }, planId: plan.id,
      }).catch(() => {});
    }
    return plan;
  };
  // Only Wedding (1,000) and Home (1,500) carry an active monthly
  // commitment -> "Promised to plans" = SGD 2,500, "Still flexible" = 1,400.
  // Safety / Freedom / Retirement exist as real plans (so their Life nodes
  // are solid) but draw no monthly contribution: the 23.6-month buffer is
  // already funded, and the rest is deliberately left flexible.
  await seedPlan("emergency", "Emergency fund", { target_months: 12, floor_months: 6, monthly_contribution: 0, essential_share: 0.75, current_savings: SAVINGS_BAL, monthly_income: INCOME, monthly_expenses: ESSENTIAL }, null);
  await seedPlan("home", "Home", { estimated_price: 600000, target_complete_month: "2031-06", monthly_contribution: 1500, property_type: "hdb_resale", down_payment_ratio: 0.2, loan_tenure: 25, rate_assumption: 3.5, renovation_reserve: 40000, keep_emergency_months: 6, current_savings: SAVINGS_BAL, monthly_income: INCOME, monthly_expenses: ESSENTIAL }, 1500);
  await seedPlan("wedding", "Wedding", { wedding_date: "2028-03", guest_count: 100, venue_tier: "mid_range", venue_type: "restaurant", photography_tier: "mid", attire_tier: "mid", total_budget: null, monthly_contribution: 1000, partner_contribution: 1000, current_savings: 8000 }, 1000);
  await seedPlan("retirement", "Retirement", { monthly_contribution: 0, target_monthly_income: 4000, future_age: 63, inflation_assumption: 2.5, longevity_years: 25, real_return_assumption: 3, minimum_current_breathing_room: 500 }, null);
  await seedPlan("investment", "Investing", { monthly_commitment: 0, target_pool: 150000, horizon_years: 12, jobs: ["growth"], liquidity_gate_years: 3, real_return_assumption: 4 }, null);
  await seedPlan("insurance", "Protection", { monthly_premium_now: 78, income_protection_months: 0, existing_income_protection: 0, existing_life_cover: 250000, existing_ci_cover: 150000, home_loan_outstanding: 0, dependents: 0, desired_cover: 500000, minimum_current_breathing_room: 500, minimum_income_protection_months: 6 }, null);

  // a Care Circle row so Family & Care has content
  await grantRole(uid, { role: "guardian", scope: "approve", relationLabel: "My sister", note: "backup approver for large moves" }).catch(() => {});

  // ---- a short history so Life Memory + playback have real records ----
  await seedLifeHistory(uid);

  // ---- one real record per feature, so no "What you've done here"
  //      section on the example account reads "Nothing yet" ----
  await seedFeatureUsage(uid);

  return { ok: true };
}

// A single representative, honest record for each feature that keeps a
// "What you've done here" history — Money Rescue, Protect & Handoff, the
// Guardian sub-sections, Explore/Spending — so the example account looks
// used, not pristine. Change Ledger events are source_type-clean and
// dated in the past; audit rows carry a short human note.
async function seedFeatureUsage(uid) {
  const led = (daysAgo, sourceFeature, actionType, opts) =>
    recordEventSafe({
      profileKey: uid, actor: opts.actor ?? "user", sourceFeature, actionType,
      status: "active", messageKey: "changeLedger.event.savings_plan_confirmed.headline",
      messageParams: { domain: opts.domain ?? sourceFeature, amount: opts.amount ?? 0 },
      relatedGoalIds: opts.relatedGoalIds ?? [], cause: opts.cause ?? { trigger: "sample_data" },
      impactSet: opts.impactSet ?? [], uncertaintyNote: opts.note ?? null, occurredAt: iso(daysAgo),
    }).catch(() => null);
  const aud = (kind, note, actorKey = null) =>
    query(`insert into audit_events (profile_key, actor_key, kind, detail) values ($1,$2,$3,$4::jsonb)`,
      [uid, actorKey ?? uid, kind, JSON.stringify({ note })]).catch(() => {});

  // Money Rescue — a recovery step actually adopted
  await led(46, "emergency", "rescue_adopted", {
    domain: "emergency", cause: { trigger: "hardship_recovery_action_applied" },
    impactSet: [{ goalId: "cashflow", metric: "freeMonthlyCashflow", before: 1200, after: 1650, unit: "sgd", direction: "up" }],
    note: "You slowed the Investing contribution for two months to rebuild breathing room.",
  });
  // Protect & Handoff — an insurance review sealed + a written handoff plan
  await led(60, "insurance", "branch_sealed", {
    domain: "insurance", cause: { trigger: "future_field_seal", domain: "insurance" },
    impactSet: [{ goalId: "insurance", metric: "coverGap", before: 250000, after: 120000, unit: "sgd", direction: "down" }],
    note: "You confirmed the term-cover top-up estimate against your real policy figures.",
  });
  await aud("handoff_plan_described", "A general handoff to your sister — written down, not yet legally executed.");
  // Guardian — a contract change, an approval, a collision path, a recovery step
  await aud("guardian_contract_changed", "Allowed Guardian to reschedule a contribution — never to move money.");
  await aud("authorization_approved", "Approved a SGD 1,200 transfer to Savings from the queue.");
  await aud("authorization_executed", "The SGD 1,200 transfer to Savings ran.");
  await led(31, "guardian", "plan_updated", {
    domain: "home", cause: { trigger: "guardian_collision_path", pathId: "ease_both", competing: ["home", "wedding"] },
    relatedGoalIds: ["home", "wedding"],
    impactSet: [
      { goalId: "home", metric: "readyMonthShift", before: 0, after: 1, unit: "date_shift_months", direction: "down" },
      { goalId: "wedding", metric: "readyMonthShift", before: 0, after: 1, unit: "date_shift_months", direction: "down" },
    ],
    note: "You chose 'ease both a little' in the Collision Radar.", actor: "user",
  });
  await aud("guardian_collision_path_applied", "Eased Home and Wedding by about SGD 90/month each.");
  await led(20, "guardian", "commitment_paused", {
    domain: "investment", cause: { trigger: "guardian_recovery" }, relatedGoalIds: ["investment"],
    impactSet: [{ goalId: "cashflow", metric: "freeMonthlyCashflow", before: 1650, after: 1650, unit: "sgd", direction: "flat" }],
    note: "Guardian paused a contribution while Safe-to-Spend recovered; you confirmed it.", actor: "guardian",
  });
  await aud("guardian_recovery_step_applied", "Confirmed the paused contribution in Recovery Mode.");
  await aud("care_view_read", "Your sister opened your money-health view.", "sister");
  // Explore / Spending — a future compared in Mirror
  await led(38, "mirror", "branch_created", {
    domain: "home", cause: { trigger: "future_comparison" }, relatedGoalIds: ["home"],
    note: "You compared 'buy Home 12 months sooner' against your current path.",
  });
}

// The causal chain the spec calls for: a starting picture, then salary,
// a wedding plan created, that plan adjusted, and a Guardian observation —
// each a real Change Ledger event with an impact_set AND a matching frozen
// Life Thread snapshot, so Life Memory and "See your line as it was then"
// work the moment the account loads. Spendable-after-living stays SGD 3,900
// throughout; what changes is what's promised (1,500 -> 3,000 -> 2,500).
async function seedLifeHistory(uid) {
  const node = (id, label, state, valueText) => ({ id, label, state, valueText: valueText ?? null, note: null });
  const compact = ({ direction, weatherId, weatherLabel, free, committed, safety }) => ({
    direction,
    directionKey: direction,
    directionParams: null,
    weather: { id: weatherId, label: weatherLabel },
    numbers: [
      { id: "free", label: "Available after living costs", value: `SGD ${free.toLocaleString("en-SG")}` },
      { id: "committed", label: "Promised to plans", value: `SGD ${committed.toLocaleString("en-SG")}/mo` },
      { id: "flexible", label: "Still flexible", value: `SGD ${(free - committed).toLocaleString("en-SG")}/mo` },
    ],
    nodes: [
      node("income", "Today", "solid", `SGD ${INCOME.toLocaleString("en-SG")}/mo`),
      node("safety", "Safety", "solid", `${safety.toFixed(1)} months`),
      node("relationships", "Wedding", "solid", "2028"),
      node("home", "Home", "solid", "2031"),
      node("freedom", "Freedom", "solid"),
      node("future", "Retirement", "solid"),
    ],
  });

  const steps = [
    {
      daysAgo: 120,
      actor: "system", sourceFeature: "life_graph", actionType: "reality_checkin_applied", status: "active",
      messageKey: "changeLedger.event.savings_plan_confirmed.headline",
      messageParams: { domain: "income", amount: INCOME },
      cause: { trigger: "income_detected" },
      relatedGoalIds: [],
      impactSet: [
        { goalId: "cashflow", metric: "spendableAfterLiving", before: 0, after: 3900, unit: "sgd", direction: "up" },
      ],
      snap: { direction: "Your income is set — SGD 3,900 a month is yours after living costs.", weatherId: "calm", weatherLabel: "Calm", free: 3900, committed: 1500, safety: 23.6 },
    },
    {
      daysAgo: 80,
      actor: "user", sourceFeature: "wedding", actionType: "commitment_created", status: "active",
      messageKey: "changeLedger.event.commitment_created.headline",
      messageParams: { amount: 1500, month: "" },
      cause: { trigger: "future_field_seal", domain: "wedding" },
      relatedGoalIds: ["wedding"],
      impactSet: [
        { goalId: "wedding", metric: "monthlyContribution", before: 0, after: 1500, unit: "sgd_per_month", direction: "down" },
        { goalId: "home", metric: "readyMonthShift", before: 0, after: 3, unit: "date_shift_months", direction: "down" },
      ],
      snap: { direction: "A wedding plan is on your line. Home moved 3 months later to make room.", weatherId: "tight", weatherLabel: "Tight", free: 3900, committed: 3000, safety: 23.6 },
    },
    {
      daysAgo: 30,
      actor: "user", sourceFeature: "wedding", actionType: "plan_updated", status: "active",
      messageKey: "changeLedger.event.savings_plan_confirmed.headline",
      messageParams: { domain: "wedding", amount: 500 },
      cause: { trigger: "future_field_seal", domain: "wedding", guestCountBefore: 150, guestCountAfter: 100 },
      relatedGoalIds: ["wedding", "home"],
      impactSet: [
        { goalId: "wedding", metric: "monthlyContribution", before: 1500, after: 1000, unit: "sgd_per_month", direction: "up" },
        { goalId: "home", metric: "readyMonthShift", before: 0, after: -2, unit: "date_shift_months", direction: "up" },
      ],
      snap: { direction: "Fewer guests freed SGD 500 a month. Home came back 2 months. Safety held.", weatherId: "recovering", weatherLabel: "Recovering", free: 3900, committed: 2500, safety: 23.6 },
    },
    {
      daysAgo: 4,
      actor: "system", sourceFeature: "guardian", actionType: "guardian_action", status: "active",
      messageKey: "changeLedger.event.savings_plan_confirmed.headline",
      messageParams: { domain: "safety", amount: CARD_BAL },
      cause: { trigger: "guardian_flag", kind: "card_before_income" },
      relatedGoalIds: [],
      impactSet: [],
      uncertaintyNote: `A SGD ${CARD_BAL.toLocaleString("en-SG")} card statement is due before your next salary. Guardian is watching it; no plan change is required yet.`,
      snap: { direction: "A SGD 2,400 card bill lands before your next salary. No plan change is needed yet.", weatherId: "calm", weatherLabel: "Calm", free: 3900, committed: 2500, safety: 23.6 },
    },
  ];

  for (const s of steps) {
    const occurredAt = iso(s.daysAgo);
    const res = await recordEventSafe({
      profileKey: uid,
      actor: s.actor,
      sourceFeature: s.sourceFeature,
      actionType: s.actionType,
      status: s.status,
      messageKey: s.messageKey,
      messageParams: s.messageParams,
      relatedGoalIds: s.relatedGoalIds,
      cause: s.cause,
      impactSet: s.impactSet,
      uncertaintyNote: s.uncertaintyNote,
      occurredAt,
    }).catch(() => null);
    const eventId = res?.event?.id ?? null;
    if (!eventId) continue;
    const ct = compact(s.snap);
    await query(
      `insert into life_thread_snapshots (profile_key, ledger_event_id, kind, event_at, thread, free_monthly, committed_monthly, safety_months)
       values ($1, $2, 'after_event', $3, $4, $5, $6, $7)
       on conflict (profile_key, ledger_event_id) where ledger_event_id is not null do nothing`,
      [uid, eventId, occurredAt, JSON.stringify(ct), s.snap.free, s.snap.committed, s.snap.safety],
    ).catch(() => {});
  }

  // the baseline — the first picture, before any plan moved
  const base = compact({ direction: "FutureOS built your first picture from your accounts, income, liabilities and 6 months of transactions.", weatherId: "calm", weatherLabel: "Calm", free: 3900, committed: 1500, safety: 23.6 });
  await query(
    `insert into life_thread_snapshots (profile_key, ledger_event_id, kind, event_at, thread, free_monthly, committed_monthly, safety_months)
     values ($1, null, 'baseline', null, $2, 3900, 1500, 23.6)
     on conflict (profile_key) where kind = 'baseline' do nothing`,
    [uid, JSON.stringify(base)],
  ).catch(() => {});
}

// ---- a youth account, so the Growing Account Today + Ask to Pay have a
// real spending stream ------------------------------------------------
export async function buildChildAccount(uid, { wipeFirst = true, guardianKey = null } = {}) {
  if (wipeFirst) await wipeSampleAccount(uid);

  await savePreferences(uid, { profileVersion: 3, profile: { statedMonthlyIncome: 130, monthlyExpenses: 80, currentSavings: 125 } });
  await setAccountType(uid, "youth");
  for (const scope of ["account_data", "transaction_data"]) await setConsent(uid, scope, true);
  for (const step of ["add_reality", "first_result", "complete"]) await advanceOnboarding(uid, step);
  await setBirthYear(uid, new Date().getFullYear() - 15).catch(() => {});

  const everyday = (await createBankAccount(uid, { kind: "current", displayName: "My account", institution: "OCBC", currency: "SGD", sourceType: "synthetic_fixture" })).id;

  const txns = [];
  const tx = (direction, amount, daysAgo, category, merchant, channel = "card") =>
    txns.push({ accountId: everyday, direction, amount, status: "posted", category, merchant, channel, postedAt: iso(daysAgo), authorisedAt: iso(daysAgo), sourceType: "synthetic_fixture" });

  tx("credit", 40, 84, "other", "Opening balance", "opening_balance");
  for (const d of [28, 21, 14, 7, 1]) tx("credit", 30, d, "transfer", "Pocket money — Mum", "transfer");
  for (const d of [27, 13]) tx("debit", 10, d, "transfer", "To savings — New bike", "transfer");
  const spends = [
    ["food", "Kopitiam", 3, 26], ["food", "Kopitiam", 4, 19], ["food", "Cheers", 2, 15],
    ["shopping", "Popular Bookstore", 9, 24], ["food", "FairPrice", 6, 12],
    ["entertainment", "Timezone Arcade", 5, 9], ["transport", "SimplyGo", 5, 6],
    ["food", "Kopitiam", 4, 3], ["shopping", "Popular Bookstore", 7, 2],
  ];
  for (const [cat, m, amt, d] of spends) tx("debit", amt, d, cat, m, "card");
  for (let i = 0; i < txns.length; i += 12) await Promise.all(txns.slice(i, i + 12).map((t) => appendTransaction(uid, t)));

  await createFinancialAsset(uid, { assetClass: "bank_account", label: "My account", linkedAccountId: everyday, currentValue: 125, liquidityClass: "cash", sourceType: "synthetic_fixture" });
  await createAsset(uid, { category: "financial", subtype: "checking_deposit", name: "OCBC My account", value: 125, details: { liquidity: "cash" } });

  // pocket money is real recurring income — without it the money-rescue
  // detectors read a tiny savings commitment as a cashflow shortfall.
  const nextPocket = new Date(); nextPocket.setDate(nextPocket.getDate() + 6);
  await createIncomeStream(uid, { label: "Pocket money", kind: "allowance", monthlyAmount: 130, payDayOfMonth: nextPocket.getDate(), nextExpectedDate: nextPocket.toISOString().slice(0, 10), detectedFromAccountId: everyday, sourceType: "synthetic_fixture" });

  // a real savings goal so Growing Account has a "Saving for" line
  const bikePlan = await planStore.getOrCreatePlan(uid, { domain: "other", goalKey: "bike", title: "New bike" });
  const bikeVersions = await planStore.listPlanVersions(bikePlan.id);
  if (bikeVersions.length === 0) {
    await planStore.appendPlanVersion(bikePlan.id, uid, { patch: { title: "New bike", target_amount: 180, monthly_contribution: 10 }, cause: { trigger: "sample_data" }, actor: "system" });
  }
  await createCommitment(uid, { domain: "other", monthlyContribution: 10, effectiveMonth: thisMonth(), pauseIfEmergencyMonthsBelow: 0, sourceMoment: { trigger: "sample_data", label: "New bike" }, planId: bikePlan.id }).catch(() => {});

  // a linked guardian (a parent), so anything that needs a yes has
  // somewhere to go, with a SGD 15/week auto-approve ceiling. When a real
  // adult account is given, link to it so they see this child under
  // Guardian → "People you look after".
  const g = await grantRole(uid, { subjectKey: guardianKey ?? `guardian-of-${uid}`, role: "guardian", scope: "approve", relationLabel: guardianKey ? "Dad" : "Mum", note: "parent" }).catch(() => null);
  if (g?.id) await query(`update lifecycle_roles set auto_approve_weekly = 15 where id = $1`, [g.id]).catch(() => {});

  // one payment already waiting for a yes
  await createAuthRequest(uid, { kind: "child_payment", summary: "Pay Steam — SGD 22", amount: 22, payload: { merchant: "Steam", source: "ask_to_pay" }, reason: "Steam is new, and it's above the SGD 15 you can spend without asking." }).catch(() => {});

  return { ok: true };
}

// ---- a later-life account with trusted help, so Calm Today + Payment
// Pause render for real ---------------------------------------------
export async function buildElderAccount(uid, { wipeFirst = true, trustedKey = null } = {}) {
  if (wipeFirst) await wipeSampleAccount(uid);

  await savePreferences(uid, { profileVersion: 3, profile: { statedMonthlyIncome: 2100, monthlyExpenses: 1450, currentSavings: 5200 } });
  await setAccountType(uid, "individual");
  for (const scope of ["account_data", "transaction_data", "assets_liabilities"]) await setConsent(uid, scope, true);
  for (const step of ["add_reality", "first_result", "complete"]) await advanceOnboarding(uid, step);

  const everyday = (await createBankAccount(uid, { kind: "current", displayName: "Everyday", institution: "OCBC", currency: "SGD", sourceType: "synthetic_fixture" })).id;

  const txns = [];
  const tx = (direction, amount, daysAgo, category, merchant, channel = "giro") =>
    txns.push({ accountId: everyday, direction, amount, status: "posted", category, merchant, channel, postedAt: iso(daysAgo), authorisedAt: iso(daysAgo), sourceType: "synthetic_fixture" });

  tx("credit", 4300, 95, "other", "Opening balance", "opening_balance");
  for (const d of [64, 34, 6]) {
    tx("credit", 2100, d, "transfer", "CPF LIFE payout", "salary");
    tx("debit", 320, d + 2, "housing", "Service & conservancy", "giro");
    tx("debit", 88, d + 3, "utilities", "SP Group", "giro");
    tx("debit", 38, d + 4, "utilities", "Singtel", "giro");
    tx("debit", 120, d + 5, "health", "Polyclinic / pharmacy", "card");
  }
  for (const [m, amt, d] of [["NTUC FairPrice", 46, 8], ["NTUC FairPrice", 52, 3], ["Kopitiam", 6, 2], ["Grab", 14, 5]]) tx("debit", amt, d, "food", m, "card");
  for (let i = 0; i < txns.length; i += 12) await Promise.all(txns.slice(i, i + 12).map((t) => appendTransaction(uid, t)));

  const next = new Date(); next.setDate(next.getDate() + 12);
  await createIncomeStream(uid, { label: "CPF LIFE", kind: "annuity", monthlyAmount: 2100, payDayOfMonth: next.getDate(), nextExpectedDate: next.toISOString().slice(0, 10), detectedFromAccountId: everyday, sourceType: "synthetic_fixture" });
  for (const [label, merchant, amt, cat, n] of [["Service & conservancy", "Town Council", 320, "housing", 6], ["Electricity & water", "SP Group", 88, "utilities", 10], ["Mobile", "Singtel", 38, "utilities", 8]]) {
    await upsertRecurringObligation(uid, { label, kind: "bill", merchant, monthlyAmount: amt, cadence: "monthly", nextDueDate: due(n), category: cat, recurringGroup: cat, sourceType: "synthetic_fixture" });
  }
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Everyday", linkedAccountId: everyday, currentValue: 5200, liquidityClass: "cash", sourceType: "synthetic_fixture" });
  await createAsset(uid, { category: "financial", subtype: "checking_deposit", name: "OCBC Everyday", value: 5200, details: { liquidity: "cash" } });

  // a trusted contact (an adult child), linked, "see anomalies + remind".
  // Link to the real adult account when one is given.
  await grantRole(uid, { subjectKey: trustedKey ?? `trusted-of-${uid}`, role: "trusted_contact", scope: "suggest", relationLabel: trustedKey ? "My son" : "My daughter", note: "emergency contact" }).catch(() => {});

  return { ok: true };
}
