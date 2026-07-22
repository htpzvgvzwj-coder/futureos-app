// Cross-goal read layer for the Investment Planner, extending
// lib/loan-context.js's pattern: parallel, sequential store calls per
// domain, no SQL join (no relation exists between domain tables to join
// on). Unlike loan-context.js's getOtherGoalsMonthlyCommitment, this never
// needs an excludeDomain — an investment commitment never funds another
// domain's collateral, so there's nothing to exclude (mirrors
// lib/hardship-context.js's simpler "sum everything" shape instead).

import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import * as loanStore from "./loan-store.js";
import { LOAN_PURPOSES } from "./loan-finance.js";

const SAVINGS_STORES = { wedding: weddingStore, home: homeStore, retirement: retirementStore };

// Sums wedding/home/retirement's confirmed monthly savings contributions
// PLUS, extending loan-context.js's own reach, every confirmed loan's
// monthly installment — loan is keyed by (profile_key, purpose), so a
// customer can hold a confirmed loan under more than one purpose at once,
// and each one is a real committed monthly outflow against the same
// cashflow an investment contribution would draw from.
export async function getOtherGoalsMonthlyCommitment(profileKey) {
  const savingsResults = await Promise.all(
    Object.values(SAVINGS_STORES).map(async (store) => {
      const session = await store.getOrCreateSession(profileKey);
      return store.getLatestArtifact(session.id, "stage2", "confirmed_savings_plan");
    }),
  );
  const loanResults = await Promise.all(
    Object.keys(LOAN_PURPOSES).map(async (purpose) => {
      const session = await loanStore.getOrCreateSession(profileKey, purpose);
      return loanStore.getLatestArtifact(session.id, "stage1", "confirmed_loan");
    }),
  );

  const savingsTotal = savingsResults.reduce((sum, plan) => sum + (plan?.monthly_contribution ?? 0), 0);
  const loanTotal = loanResults.reduce((sum, loan) => sum + (loan?.monthly_installment ?? 0), 0);

  return { total: savingsTotal + loanTotal, savingsTotal, loanTotal };
}

// For the "retirement_gap" goal-category intake option — reads retirement's
// already-computed gap directly rather than re-deriving it; Investment
// Planner never re-collects or re-estimates it.
export async function getRetirementGap(profileKey) {
  const session = await retirementStore.getOrCreateSession(profileKey);
  const plan = await retirementStore.getLatestArtifact(session.id, "stage1", "confirmed_plan");
  return plan ? { gapMonthly: plan.gap_monthly, targetMonthlyIncome: plan.target_monthly_income } : null;
}
