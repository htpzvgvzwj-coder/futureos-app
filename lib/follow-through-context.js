// Cross-domain read layer for the Follow-Through Score (履约分), mirroring
// lib/strategic-balance-context.js's pattern: parallel reads per domain,
// no relation to join on. Unlike Strategic Balance, this reads the real
// savings-checkin history (not just the latest confirmed monthly figure),
// because the score needs to know whether the customer actually kept
// showing up, not just what they once promised.

import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import * as hardshipStore from "./hardship-store.js";

const SAVINGS_STORES = { wedding: weddingStore, home: homeStore, retirement: retirementStore };

async function getDomainFollowThrough(domain, store) {
  const session = await store.getOrCreateSession(store.DEFAULT_PROFILE_KEY);
  const confirmed = await store.getLatestArtifactWithTimestamp(session.id, "stage2", "confirmed_savings_plan");
  if (!confirmed) return null;

  const checkins = await store.getSavingsCheckins(session.id);
  return {
    domain,
    monthlyContribution: confirmed.payload.monthly_contribution,
    confirmedAt: confirmed.createdAt,
    checkins: checkins.map((row) => ({
      month: row.checkin_month,
      amount: Number(row.amount),
      note: row.note,
    })),
  };
}

async function getHardshipEvidence() {
  const session = await hardshipStore.getOrCreateSession(hardshipStore.DEFAULT_PROFILE_KEY);
  const appliedActions = await hardshipStore.getAppliedActions(session.id);
  return appliedActions
    .filter((action) => action.status === "applied")
    .map((action) => ({
      actionType: action.action_type,
      explanation: action.explanation,
      appliedAt: action.applied_at ? new Date(action.applied_at).toISOString() : null,
    }));
}

export async function getFollowThroughSnapshot() {
  const [domains, hardshipEvidence] = await Promise.all([
    Promise.all(Object.entries(SAVINGS_STORES).map(([domain, store]) => getDomainFollowThrough(domain, store))),
    getHardshipEvidence(),
  ]);
  return { domains: domains.filter(Boolean), hardshipEvidence };
}
