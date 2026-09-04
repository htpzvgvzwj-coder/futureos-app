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
  "user_preferences", "assets", "provider_connections",
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

const INCOME = 6000;
const SAVINGS_BAL = 21000;
const EVERYDAY_BAL = 4300;
const CPF_OA = 46000;
const CPF_SA = 24000;
const FUND = 14500;
const CARD_BAL = 620;

export async function buildSampleAccount(uid, { wipeFirst = true } = {}) {
  if (wipeFirst) await wipeSampleAccount(uid);

  // profile — Life Thread + Guardian read stated income / expenses / savings from here
  await savePreferences(uid, {
    profileVersion: 3,
    profile: { statedMonthlyIncome: INCOME, monthlyExpenses: 2800, currentSavings: 25300, creditCardOutstanding: CARD_BAL },
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

  tx(everyday, "credit", 4100, 95, "other", "Opening balance", "opening_balance");
  tx(savings, "credit", 20250, 95, "other", "Opening balance", "opening_balance");

  for (const d of [92, 61, 31, 2]) {
    tx(everyday, "credit", INCOME, d, "transfer", "ACME PTE LTD — SALARY", "salary");
    tx(everyday, "debit", 250, d - 1, "transfer", "Monthly transfer to Savings", "transfer");
    tx(savings, "credit", 250, d - 1, "transfer", "From Everyday — monthly", "transfer");
  }

  const bills = [
    ["housing", "Rent — S. Tan (landlord)", 1300],
    ["utilities", "SP Group", 118],
    ["utilities", "Singtel Mobile", 38],
    ["utilities", "MyRepublic Broadband", 40],
    ["health", "Anytime Fitness", 70],
    ["entertainment", "Netflix", 18],
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
    ["Rent", "bill", "S. Tan", 1300, "housing", "rent", 4],
    ["Electricity & water", "bill", "SP Group", 118, "utilities", "sp", 12],
    ["Mobile", "bill", "Singtel", 38, "utilities", "mobile", 6],
    ["Broadband", "bill", "MyRepublic", 40, "utilities", "broadband", 9],
    ["Gym", "subscription", "Anytime Fitness", 70, "health", "gym", 2],
    ["Netflix", "subscription", "Netflix", 18, "entertainment", "netflix", 15],
    ["Spotify", "subscription", "Spotify", 12, "entertainment", "spotify", 17],
  ];
  for (const [label, kind, merchant, amt, category, group, n] of obs) {
    await upsertRecurringObligation(uid, {
      label, kind, merchant, monthlyAmount: amt, cadence: "monthly", nextDueDate: due(n),
      category, recurringGroup: group, sourceType: "synthetic_fixture",
    });
  }

  // Financial Twin ledger + Asset Profile (read by different parts; keep in step)
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Everyday", linkedAccountId: everyday, currentValue: EVERYDAY_BAL, liquidityClass: "cash", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Savings (emergency fund)", linkedAccountId: savings, currentValue: SAVINGS_BAL, liquidityClass: "near_cash", restrictedPurpose: "emergency", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "cpf_oa", label: "CPF Ordinary Account", currentValue: CPF_OA, liquidityClass: "restricted", restrictedPurpose: "housing", sourceType: "government_linked", sourceName: "SGFinDex", confidence: "high" });
  await createFinancialAsset(uid, { assetClass: "cpf_sa_ra", label: "CPF Special Account", currentValue: CPF_SA, liquidityClass: "restricted", restrictedPurpose: "retirement", sourceType: "government_linked", sourceName: "SGFinDex", confidence: "high" });
  await createFinancialAsset(uid, { assetClass: "investment", label: "Global equity index fund", currentValue: FUND, liquidityClass: "liquid", sourceType: "synthetic_fixture", confidence: "low" });
  await createLiability(uid, { liabilityClass: "credit_card_statement", label: "365 Credit Card", linkedAccountId: card, currentBalance: CARD_BAL, apr: 26.8, minimumMonthly: 50, nextDueDate: due(18), sourceType: "synthetic_fixture" });

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
  await seedPlan("emergency", "Emergency fund", { target_months: 6, floor_months: 3, monthly_contribution: 250, essential_share: 0.72, current_savings: 21000, monthly_income: 6000, monthly_expenses: 2800 }, 250);
  await seedPlan("home", "Home", { estimated_price: 520000, target_complete_month: "2029-09", monthly_contribution: 700, property_type: "hdb_resale", down_payment_ratio: 0.2, loan_tenure: 25, rate_assumption: 3.5, renovation_reserve: 30000, keep_emergency_months: 6, current_savings: 21000, monthly_income: 6000, monthly_expenses: 2800 }, 700);
  await seedPlan("wedding", "Wedding", { wedding_date: "2028-03", guest_count: 110, venue_tier: "mid_range", venue_type: "restaurant", photography_tier: "mid", attire_tier: "mid", total_budget: null, monthly_contribution: 500, partner_contribution: 500, current_savings: 5000 }, 500);
  await seedPlan("retirement", "Retirement", { monthly_contribution: 300, target_monthly_income: 3500, future_age: 63, inflation_assumption: 2.5, longevity_years: 25, real_return_assumption: 3, minimum_current_breathing_room: 300 }, 300);
  await seedPlan("investment", "Investing", { monthly_commitment: 400, target_pool: 120000, horizon_years: 12, jobs: ["growth"], liquidity_gate_years: 3, real_return_assumption: 4 }, 400);
  await seedPlan("insurance", "Protection", { monthly_premium_now: 78, income_protection_months: 0, existing_income_protection: 0, existing_life_cover: 250000, existing_ci_cover: 150000, home_loan_outstanding: 0, dependents: 0, desired_cover: 500000, minimum_current_breathing_room: 300, minimum_income_protection_months: 6 }, null);

  // a Care Circle row so Family & Care has content
  await grantRole(uid, { role: "guardian", scope: "approve", relationLabel: "My sister", note: "backup approver for large moves" }).catch(() => {});

  return { ok: true };
}
