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
  "care_transitions", "care_nudges", "care_invites", "audit_events", "user_onboarding", "user_preferences",
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
      statedMonthlyIncome: 6500,
      monthlyExpenses: 3600,
      currentSavings: 18600, // Everyday 3,200 + Savings 15,400
      creditCardOutstanding: 760,
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

  // opening balances
  await tx(everyday, "credit", 3200, 95, "other", "Opening balance", "opening_balance");
  await tx(savings, "credit", 15400, 95, "other", "Opening balance", "opening_balance");

  // 3 months of salary
  for (const d of [92, 62, 31, 1]) await tx(everyday, "credit", 6500, d, "transfer", "ACME PTE LTD — SALARY", "salary");

  // ~90 days of categorised spend (enough per category for Spending Intelligence)
  const spend = [
    ["housing", "Rent — landlord", [88, 58, 28]],
    ["bills", "SP Utilities", [86, 56, 26]],
    ["bills", "Singtel Mobile", [84, 54, 24]],
    ["entertainment", "Netflix", [83, 53, 23]],
    ["food", "FairPrice Finest", [82, 74, 66, 52, 44, 36, 22, 14, 6]],
    ["food", "Kopitiam", [80, 76, 70, 64, 50, 40, 33, 21, 12, 4]],
    ["transport", "SimplyGo", [79, 71, 61, 49, 41, 31, 19, 9]],
    ["shopping", "Uniqlo", [67, 38, 11]],
    ["health", "Guardian Pharmacy", [72, 27]],
    ["entertainment", "Golden Village", [59, 18]],
  ];
  const amtFor = { housing: 2000, bills: [180, 45, 20], food: 34, transport: 12, shopping: 79, health: 26, entertainment: 21 };
  for (const [cat, merchant, days] of spend) {
    days.forEach((d, i) => {
      let amt = amtFor[cat];
      if (Array.isArray(amt)) amt = amt[["SP Utilities", "Singtel Mobile", "Netflix"].indexOf(merchant)] ?? 40;
      if (cat === "food") amt = 18 + ((i * 13) % 40);
      if (cat === "transport") amt = 6 + ((i * 7) % 16);
      const acct = cat === "housing" || cat === "bills" ? everyday : card;
      return tx(acct, "debit", amt, d, cat, merchant, acct === everyday ? "transfer" : "card");
    });
  }
  // card gets partially repaid, leaving a small balance
  await tx(everyday, "debit", 900, 20, "transfer", "Card payment", "transfer");
  await tx(card, "credit", 900, 20, "transfer", "Payment received", "card_repayment");

  // ---- income + bills ----
  const next = new Date(); next.setDate(next.getDate() + 9);
  await createIncomeStream(uid, { label: "ACME salary", kind: "salary", monthlyAmount: 6500, payDayOfMonth: next.getDate(), nextExpectedDate: next.toISOString().slice(0, 10), detectedFromAccountId: everyday, sourceType: "synthetic_fixture" });
  const due = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  await upsertRecurringObligation(uid, { label: "Rent", kind: "bill", merchant: "Landlord", monthlyAmount: 2000, cadence: "monthly", nextDueDate: due(4), category: "housing", recurringGroup: "rent", sourceType: "synthetic_fixture" });
  await upsertRecurringObligation(uid, { label: "Utilities", kind: "bill", merchant: "SP", monthlyAmount: 180, cadence: "monthly", nextDueDate: due(11), category: "bills", recurringGroup: "utilities", sourceType: "synthetic_fixture" });
  await upsertRecurringObligation(uid, { label: "Mobile", kind: "bill", merchant: "Singtel", monthlyAmount: 45, cadence: "monthly", nextDueDate: due(6), category: "bills", recurringGroup: "mobile", sourceType: "synthetic_fixture" });
  await upsertRecurringObligation(uid, { label: "Netflix", kind: "subscription", merchant: "Netflix", monthlyAmount: 20, cadence: "monthly", nextDueDate: due(15), category: "entertainment", recurringGroup: "netflix", sourceType: "synthetic_fixture" });
  await upsertRecurringObligation(uid, { label: "Gym", kind: "subscription", merchant: "Anytime Fitness", monthlyAmount: 90, cadence: "monthly", nextDueDate: due(2), category: "health", recurringGroup: "gym", sourceType: "synthetic_fixture" });

  // ---- assets + liabilities ----
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Everyday", linkedAccountId: everyday, currentValue: 3200, liquidityClass: "cash", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "bank_account", label: "Savings", linkedAccountId: savings, currentValue: 15400, liquidityClass: "near_cash", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "cpf_oa", label: "CPF Ordinary Account", currentValue: 41800, liquidityClass: "restricted", restrictedPurpose: "housing", sourceType: "synthetic_fixture", confidence: "medium" });
  await createFinancialAsset(uid, { assetClass: "cpf_sa_ra", label: "CPF Special Account", currentValue: 22600, liquidityClass: "restricted", restrictedPurpose: "retirement", sourceType: "synthetic_fixture" });
  await createFinancialAsset(uid, { assetClass: "investment", label: "Global equity fund", currentValue: 18250, liquidityClass: "liquid", sourceType: "synthetic_fixture", confidence: "low" });
  await createLiability(uid, { liabilityClass: "credit_card_statement", label: "365 Credit Card", linkedAccountId: card, currentBalance: 760, apr: 26.8, minimumMonthly: 50, nextDueDate: due(18), sourceType: "synthetic_fixture" });

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
  await seedPlan("emergency", "Emergency fund", { target_months: 6, floor_months: 3, monthly_contribution: 300, essential_share: 0.72, current_savings: 15400, monthly_income: 6500, monthly_expenses: 3600 }, 300);
  await seedPlan("home", "Home", { estimated_price: 560000, target_complete_month: "2029-06", monthly_contribution: 900, property_type: "hdb_resale", down_payment_ratio: 0.2, loan_tenure: 25, rate_assumption: 3.5, renovation_reserve: 35000, keep_emergency_months: 6, current_savings: 15400, monthly_income: 6500, monthly_expenses: 3600 }, 900);
  await seedPlan("wedding", "Wedding", { wedding_date: "2027-10", guest_count: 120, venue_tier: "mid_range", venue_type: "restaurant", photography_tier: "mid", attire_tier: "mid", total_budget: null, monthly_contribution: 700, partner_contribution: 500, current_savings: 6000 }, 700);

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
