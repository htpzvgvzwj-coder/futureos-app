// Seed ONE dedicated, deterministic E2E identity per (Studio domain x
// Playwright project) - 9 x 3 = 27 users - each with only its own Studio's
// reality path, and write a per-identity Playwright storageState so the
// suite never skips for a missing login AND one run's Seal never pollutes
// another's cross-goal assertions.
//
//   npm run test:e2e:seed        # once (needs DATABASE_URL + the app's auth)
//   npm run dev                  # app on 127.0.0.1:3000
//   npm run test:e2e
//
// Idempotent: re-running re-keys nothing new; it refreshes each session
// token + storageState file.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUser, createSession, SESSION_COOKIE_NAME } from "../lib/auth.js";
import { query } from "../lib/db.js";
import { planStore } from "../lib/plan-runtime/index.js";
import { STUDIOS, PROJECTS, identityEmail, authFileFor } from "../e2e/identities.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-password-not-secret";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

// A minimal, honest reality path per Studio domain (real numbers, no demo
// copy). Each identity is seeded with ONLY its own domain's path.
const REALITY = {
  home: { estimated_price: 620000, target_complete_month: "2028-06", monthly_contribution: 1800, property_type: "hdb_resale", down_payment_ratio: 0.25, loan_tenure: 25, rate_assumption: 3.5, renovation_reserve: 40000, keep_emergency_months: 6, current_savings: 90000, monthly_income: 8200, monthly_expenses: 3900 },
  emergency: { target_months: 6, floor_months: 3, monthly_contribution: 500, essential_share: 0.75, current_savings: 14000, monthly_income: 7800, monthly_expenses: 3800 },
  loan: { loan_amount: 40000, annual_rate_percent: 4.5, tenure_years: 7, monthly_installment: 555, extra_repayment: 0, credit_card_outstanding: 2000, monthly_income: 7000, monthly_expenses: 3800, current_savings: 25000 },
  retirement: { target_monthly_income: 4200, gap_monthly: 2000, monthly_contribution: 500, current_savings: 30000, monthly_income: 7800, monthly_expenses: 3900, current_age: 42, future_age: 65 },
  travel: { destination_type: "regional", comfort_tier: "mid", travellers: 2, nights: 8, trip_month: "2027-06", monthly_contribution: 300, current_savings: 5000, monthly_income: 7000, monthly_expenses: 3800 },
  investment: { jobs: { safety: 0, wedding: 0, home: 0, flexible: 1200, retirement: 0, longTerm: 800 }, liquidity_gate_years: 3, target_pool: 200000, current_savings: 40000, credit_card_outstanding: 0, monthly_income: 7800, monthly_expenses: 3900 },
  insurance: { monthly_expenses: 4000, income_protection_months: 12, existing_income_protection: 20000, home_loan_outstanding: 300000, existing_life_cover: 100000, dependents: 0, annual_care_cost: 10000, existing_ci_cover: 30000, care_years: 3, monthly_premium_now: 60, monthly_income: 8000 },
  family: { shared_monthly_contribution: 2000, partner_share_ratio: 0.55, items: [{ id: "education", label: "Education", monthlyCost: 700 }], monthly_income: 7800, monthly_expenses: 3900 },
  wedding: { wedding_date: "2027-06", guest_count: 150, venue_tier: "mid_range", venue_type: "hotel", photography_tier: "mid", attire_tier: "mid", total_budget: null, monthly_contribution: 800, partner_contribution: 400, current_savings: 6000 },
};

mkdirSync(path.join(ROOT, "e2e/.auth"), { recursive: true });
const url = new URL(BASE_URL);
let created = 0;
let refreshed = 0;

for (const studio of STUDIOS) {
  const domain = studio.domain;
  const patch = REALITY[domain];
  for (const project of PROJECTS) {
    const email = identityEmail(domain, project);
    const existing = await query(`select id, email from users where email = $1`, [email]);
    const user = existing.rows[0] ?? (await createUser({ email, password: E2E_PASSWORD, displayName: `E2E ${domain}` }));
    if (!existing.rows[0]) created += 1;

    const plan = await planStore.getOrCreatePlan(user.id, { domain, goalKey: domain, title: domain });
    const versions = await planStore.listPlanVersions(plan.id);
    if (versions.length === 0) {
      await planStore.appendPlanVersion(plan.id, user.id, { patch, cause: { trigger: "e2e_seed" }, actor: "system" });
    }

    const { token, expiresAt } = await createSession(user.id);
    const storageState = {
      cookies: [
        {
          name: SESSION_COOKIE_NAME,
          value: token,
          domain: url.hostname,
          path: "/",
          expires: Math.floor(new Date(expiresAt).getTime() / 1000),
          httpOnly: true,
          secure: url.protocol === "https:",
          sameSite: "Lax",
        },
      ],
      origins: [],
    };
    const outFile = path.join(ROOT, authFileFor(domain, project));
    writeFileSync(outFile, JSON.stringify(storageState, null, 2) + "\n");
    refreshed += 1;
    console.log(`  ${domain} / ${project}: ${email}  -> ${path.relative(ROOT, outFile)}`);
  }
}

console.log(`\n${created} new identit${created === 1 ? "y" : "ies"}, ${refreshed} storageState file(s) refreshed.`);
console.log(`Now: npm run dev  (on ${BASE_URL})  then  npm run test:e2e`);
process.exit(0);
