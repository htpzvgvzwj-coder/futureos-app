// Seed ONE full demo account so every tab and every feature has real data
// the moment you log in — accounts + 90 days of categorised transactions,
// income, bills, CPF + an investment, a card balance, and three Studio
// plans (Home / Wedding / Emergency) with active monthly commitments.
//
//   npm run seed:demo
//
// Idempotent: re-running wipes this one account's data and rebuilds it.
// Every seeded figure is source_type 'synthetic_fixture' or 'user_confirmed'
// — never presented as a bank fact. Prints the login when done.

import bcrypt from "bcryptjs";
import { createUser } from "../lib/auth.js";
import { query } from "../lib/db.js";
import {
  setAccountType, setConsent, advanceOnboarding,
} from "../lib/account-control/store.js";
import { createBankAccount } from "../lib/bank/accounts-store.js";
import { createAsset } from "../lib/asset-store.js";
import { appendTransaction } from "../lib/transaction-ledger/store.js";
import { createFinancialAsset, createLiability, createIncomeStream, upsertRecurringObligation } from "../lib/financial-twin/rows-store.js";
import { createCommitment } from "../lib/goal-commitment-store.js";
import { planStore } from "../lib/plan-runtime/index.js";
import { grantRole } from "../lib/account-control/store.js";
import { savePreferences } from "../lib/preferences-store.js";

const EMAIL = process.env.DEMO_EMAIL ?? "demo@futureos.app";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";
const BASE = process.env.DEMO_BASE_URL ?? "https://futureos-app.vercel.app";

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const thisMonth = () => new Date().toISOString().slice(0, 7);

const OWNED = [
  "bank_transactions", "import_batches", "financial_assets", "liabilities", "income_streams",
  "recurring_obligations", "ripple_events", "change_ledger_events", "money_moment_state",
  "goal_commitments", "bank_accounts", "consent_records", "lifecycle_roles", "care_handoff_plans",
  "authorization_requests", "authorization_policies", "guardian_contracts", "care_shared_ranges",
  "care_transitions", "care_nudges", "care_invites", "audit_events", "user_onboarding", "user_preferences", "assets",
];

async function wipe(uid) {
  for (const t of OWNED) {
    await query(`delete from ${t} where profile_key = $1`, [uid]).catch(() => {});
  }
  // plans + versions + branches
  const plans = await query(`select id from plans where profile_key = $1`, [uid]).catch(() => ({ rows: [] }));
  for (const p of plans.rows) {
    await query(`delete from plan_branches where plan_id = $1`, [p.id]).catch(() => {});
    await query(`delete from plan_versions where plan_id = $1`, [p.id]).catch(() => {});
  }
  await query(`delete from plans where profile_key = $1`, [uid]).catch(() => {});
}

async function main() {
  let u = (await query(`select id from users where email = $1`, [EMAIL])).rows[0];
  if (u) {
    console.log(`• existing demo user ${EMAIL} — wiping its data`);
    await wipe(u.id);
    await query(`update users set password_hash = $2, display_name = 'Demo' where id = $1`, [u.id, await bcrypt.hash(PASSWORD, 12)]);
  } else {
    u = await createUser({ email: EMAIL, password: PASSWORD, displayName: "Demo" });
    console.log(`• created demo user ${EMAIL}`);
  }
  const uid = u.id;

  // ---- profile (Life Thread + Guardian read stated income / expenses / savings from here) ----
  await savePreferences(uid, {
    profileVersion: 3,
    profile: {
      statedMonthlyIncome: 6000,
      monthlyExpenses: 2800,
      currentSavings: 25300, // Everyday 4,300 + Savings 21,000
      creditCardOutstanding: 620,
    },
  });

  // ---- onboarding ----
  await setAccountType(uid, "individual");
  for (const scope of ["account_data", "transaction_data", "assets_liabilities", "planning_data"]) {
    await setConsent(uid, scope, true);
  }
  await advanceOnboarding(uid, "add_reality");
  await advanceOnboarding(uid, "first_result");
  await advanceOnboarding(uid, "complete");

  // ---- accounts ----
  const everydayAcc = await createBankAccount(uid, { kind: "current", displayName: "Everyday", institution: "OCBC", currency: "SGD", sourceType: "synthetic_fixture" });
  const savingsAcc = await createBankAccount(uid, { kind: "savings", displayName: "Savings", institution: "OCBC", currency: "SGD", sourceType: "synthetic_fixture" });
  const cardAcc = await createBankAccount(uid, { kind: "credit_card", displayName: "365 Credit Card", institution: "OCBC", currency: "SGD", creditLimit: 12000, sourceType: "synthetic_fixture" });
  const everyday = everydayAcc.id, savings = savingsAcc.id, card = cardAcc.id;

  const tx = (accountId, direction, amount, daysAgo, category, merchant, channel = "card") =>
    appendTransaction(uid, {
      accountId, direction, amount, status: "posted", category, merchant, channel,
      postedAt: iso(daysAgo), authorisedAt: iso(daysAgo), sourceType: "synthetic_fixture",
    });

  // A realistic mid-career single in Singapore, ~SGD 6,000 take-home.
  const INCOME = 6000;
  // opening balances (95 days ago) so the running ledger lands near a
  // realistic present-day balance: Everyday ~4,300, Savings ~21,000.
  await tx(everyday, "credit", 4100, 95, "other", "Opening balance", "opening_balance");
  await tx(savings, "credit", 20250, 95, "other", "Opening balance", "opening_balance");

  // 3 monthly salary credits + a monthly standing transfer to savings
  for (const d of [92, 61, 31, 2]) {
    await tx(everyday, "credit", INCOME, d, "transfer", "ACME PTE LTD — SALARY", "salary");
    await tx(everyday, "debit", 250, d - 1, "transfer", "Monthly transfer to Savings", "transfer");
    await tx(savings, "credit", 250, d - 1, "transfer", "From Everyday — monthly", "transfer");
  }

  // recurring bills, paid from Everyday each month
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
    for (const d of [84, 54, 24]) await tx(everyday, "debit", amt, d, cat, merchant, "giro");
  }

  // day-to-day spend on the card — several per category over 90 days
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
      await tx(card, "debit", amt, Math.max(1, Math.min(89, day)), cat, merchant, "card");
    }
  }
  // pay most of the card off each month, leaving a small rolling balance
  for (const d of [70, 40, 10]) {
    await tx(everyday, "debit", 640, d, "transfer", "Credit card payment", "card_repayment");
    await tx(card, "credit", 640, d, "transfer", "Payment received — thank you", "card_repayment");
  }

  // ---- income stream + recurring obligations (Bills view + Safe-to-Spend) ----
  const next = new Date(); next.setDate(next.getDate() + 9);
  await createIncomeStream(uid, { label: "ACME salary", kind: "salary", monthlyAmount: INCOME, payDayOfMonth: next.getDate(), nextExpectedDate: next.toISOString().slice(0, 10), detectedFromAccountId: everyday, sourceType: "synthetic_fixture" });
  const due = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
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
    await upsertRecurringObligation(uid, { label, kind, merchant, monthlyAmount: amt, cadence: "monthly", nextDueDate: due(n), category, recurringGroup: group, sourceType: "synthetic_fixture" });
  }

  // ---- assets: the Financial Twin ledger AND the Asset Profile (both are
  // read by different parts of the app; keep them in step) ----
  const SAVINGS_BAL = 21000, EVERYDAY_BAL = 4300, CPF_OA = 46000, CPF_SA = 24000, FUND = 14500, CARD_BAL = 620;
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Everyday", linkedAccountId: everyday, currentValue: EVERYDAY_BAL, liquidityClass: "cash", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Savings (emergency fund)", linkedAccountId: savings, currentValue: SAVINGS_BAL, liquidityClass: "near_cash", restrictedPurpose: "emergency", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "cpf_oa", label: "CPF Ordinary Account", currentValue: CPF_OA, liquidityClass: "restricted", restrictedPurpose: "housing", sourceType: "synthetic_fixture", confidence: "medium" });
  await createFinancialAsset(uid, { assetClass: "cpf_sa_ra", label: "CPF Special Account", currentValue: CPF_SA, liquidityClass: "restricted", restrictedPurpose: "retirement", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "investment", label: "Global equity index fund", currentValue: FUND, liquidityClass: "liquid", sourceType: "synthetic_fixture", confidence: "low" });
  await createLiability(uid, { liabilityClass: "credit_card_statement", label: "365 Credit Card", linkedAccountId: card, currentBalance: CARD_BAL, apr: 26.8, minimumMonthly: 50, nextDueDate: due(18), sourceType: "synthetic_fixture" });

  // Asset Profile rows (drives the emergency-buffer / liquid-savings reads)
  await createAsset(uid, { category: "financial", subtype: "checking_deposit", name: "OCBC Everyday", value: EVERYDAY_BAL, details: { liquidity: "cash" } });
  await createAsset(uid, { category: "financial", subtype: "cash", name: "OCBC Savings", value: SAVINGS_BAL, details: { liquidity: "near_cash" } });
  await createAsset(uid, { category: "financial", subtype: "fund", name: "Global equity index fund", value: FUND, details: { liquidity: "illiquid", risk: "medium" } });
  await createAsset(uid, { category: "financial", subtype: "pension", name: "CPF (OA + SA)", value: CPF_OA + CPF_SA, details: { liquidity: "illiquid" } });
  await createAsset(uid, { category: "legal", subtype: "insurance_policy", name: "Term life + CI (Great Eastern)", value: null, details: { status: "active", coverage: 250000, kind: "term_life_ci", premiumMonthly: 78 } });

  // ---- three Studio plans + active monthly commitments ----
  const seedPlan = async (domain, title, patch, monthly) => {
    const plan = await planStore.getOrCreatePlan(uid, { domain, goalKey: domain, title });
    const versions = await planStore.listPlanVersions(plan.id);
    if (versions.length === 0) {
      await planStore.appendPlanVersion(plan.id, uid, { patch, cause: { trigger: "demo_seed" }, actor: "system" });
    }
    if (monthly) {
      await createCommitment(uid, {
        domain, monthlyContribution: monthly, effectiveMonth: thisMonth(),
        pauseIfEmergencyMonthsBelow: 3, sourceMoment: { trigger: "demo_seed" }, planId: plan.id,
      }).catch((e) => console.log(`  (commitment ${domain}: ${e.message})`));
    }
    return plan;
  };
  await seedPlan("emergency", "Emergency fund", { target_months: 6, floor_months: 3, monthly_contribution: 250, essential_share: 0.72, current_savings: 21000, monthly_income: 6000, monthly_expenses: 2800 }, 250);
  await seedPlan("home", "Home", { estimated_price: 520000, target_complete_month: "2029-09", monthly_contribution: 700, property_type: "hdb_resale", down_payment_ratio: 0.2, loan_tenure: 25, rate_assumption: 3.5, renovation_reserve: 30000, keep_emergency_months: 6, current_savings: 21000, monthly_income: 6000, monthly_expenses: 2800 }, 700);
  await seedPlan("wedding", "Wedding", { wedding_date: "2028-03", guest_count: 110, venue_tier: "mid_range", venue_type: "restaurant", photography_tier: "mid", attire_tier: "mid", total_budget: null, monthly_contribution: 500, partner_contribution: 500, current_savings: 5000 }, 500);

  // ---- a Care Circle row so Family & Care has content ----
  await grantRole(uid, { role: "guardian", scope: "approve", relationLabel: "My sister", note: "backup approver for large moves" }).catch(() => {});

  console.log("\n✓ demo account ready\n");
  console.log(`   URL:      ${BASE}`);
  console.log(`   email:    ${EMAIL}`);
  console.log(`   password: ${PASSWORD}\n`);
  console.log("   Today: net worth + Safe-to-Spend + recent activity");
  console.log("   Life:  Living Thread with Home / Wedding / Safety nodes, a direction line");
  console.log("   Explore: Spending Intelligence (90d history), Financial Twin, Connections");
  console.log("   Guardian: Promise Shield buckets, protection domains, contract\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
