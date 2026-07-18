// Cross-goal read layer. No existing store module aggregates across
// domains — every API route today imports exactly one of
// wedding-store.js/home-store.js/retirement-store.js. This is the first
// feature that genuinely needs to see all three at once, since a hardship
// recovery plan has to account for every committed savings plan the
// customer actually has, not just one goal in isolation.

import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";

const DOMAIN_CONFIG = {
  wedding: { store: weddingStore, confirmArtifactType: "confirmed_budget" },
  home: { store: homeStore, confirmArtifactType: "confirmed_plan" },
  retirement: { store: retirementStore, confirmArtifactType: "confirmed_plan" },
};

async function getDomainCommitment(domain) {
  const { store, confirmArtifactType } = DOMAIN_CONFIG[domain];
  const session = await store.getOrCreateSession(store.DEFAULT_PROFILE_KEY);
  const [confirmedPlan, confirmedSavingsPlan] = await Promise.all([
    store.getLatestArtifact(session.id, "stage1", confirmArtifactType),
    store.getLatestArtifact(session.id, "stage2", "confirmed_savings_plan"),
  ]);
  return {
    hasCommitment: Boolean(confirmedPlan || confirmedSavingsPlan),
    confirmedPlan,
    confirmedSavingsPlan,
  };
}

export async function getCustomerCommitments() {
  const [wedding, home, retirement] = await Promise.all([
    getDomainCommitment("wedding"),
    getDomainCommitment("home"),
    getDomainCommitment("retirement"),
  ]);
  return { wedding, home, retirement };
}

// Not a DB read — currentSavings/monthlyExpenses/monthlyIncome live only in
// the client's localStorage-backed preferences, sent in the request body the
// same way home/stage1 already receives profile.monthlyIncome/monthlyExpenses.
export function getEmergencyFundSnapshot(profile) {
  return {
    currentFund: Number(profile.currentSavings) || 0,
    monthlyExpenses: Number(profile.monthlyExpenses) || 0,
    monthlyIncome: Number(profile.monthlyIncome) || 0,
  };
}
