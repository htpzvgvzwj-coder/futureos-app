// Cross-goal read layer for the Loan Planner, mirroring lib/hardship-context.js's
// pattern exactly: parallel, sequential store calls per domain, no SQL join
// (no relation exists between domain tables to join on).

import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";

const STORES = { wedding: weddingStore, home: homeStore, retirement: retirementStore };

// Excludes the home domain's own savings commitment when the loan purpose
// IS "home" (a home loan shouldn't be penalized against the down-payment
// savings it is itself funding) but includes it for every other purpose.
export async function getOtherGoalsMonthlyCommitment(excludeDomain) {
  const domains = Object.keys(STORES).filter((domain) => domain !== excludeDomain);
  const results = await Promise.all(
    domains.map(async (domain) => {
      const store = STORES[domain];
      const session = await store.getOrCreateSession(store.DEFAULT_PROFILE_KEY);
      return store.getLatestArtifact(session.id, "stage2", "confirmed_savings_plan");
    }),
  );
  const total = results.reduce((sum, plan) => sum + (plan?.monthly_contribution ?? 0), 0);
  return { total };
}

// For purpose === "home": read the confirmed property price directly from
// the home domain — Loan Planner never re-collects or re-estimates it.
export async function getConfirmedHomePrice() {
  const session = await homeStore.getOrCreateSession(homeStore.DEFAULT_PROFILE_KEY);
  const plan = await homeStore.getLatestArtifact(session.id, "stage1", "confirmed_plan");
  return plan ? { price: plan.price, propertyType: plan.property_type } : null;
}
