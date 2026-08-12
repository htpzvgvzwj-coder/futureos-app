import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import { getUnresolvedConfirmedDebates } from "./mirror-store.js";

// Matches lib/hardship-context.js's existing domain scope (wedding/home/
// retirement only, not "other") for consistency with that already-
// established precedent rather than silently widening it here.
const CHECKIN_DOMAIN_STORES = { wedding: weddingStore, home: homeStore, retirement: retirementStore };

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

async function getMissingCheckinLoops(profileKey) {
  const nowMonth = currentMonthValue();
  const results = await Promise.all(
    Object.entries(CHECKIN_DOMAIN_STORES).map(async ([domain, store]) => {
      const session = await store.getOrCreateSession(profileKey);
      const confirmedSavingsPlan = await store.getLatestArtifact(session.id, "stage2", "confirmed_savings_plan");
      if (!confirmedSavingsPlan) return null;
      const checkins = await store.getSavingsCheckins(session.id);
      const hasCheckinThisMonth = checkins.some((checkin) => checkin.checkin_month === nowMonth);
      if (hasCheckinThisMonth) return null;
      return {
        type: "missing_checkin",
        domain,
        date: checkins[checkins.length - 1]?.created_at ?? null,
      };
    })
  );
  return results.filter(Boolean);
}

async function getUnresolvedDebateLoops(profileKey) {
  const rows = await getUnresolvedConfirmedDebates(profileKey);
  return rows.map((row) => ({
    type: "unresolved_debate",
    domain: row.goal_type,
    date: row.confirmed_at,
  }));
}

// Real, not arbitrary - matches 2BB's own "max 3" framing for this widget.
const MAX_OPEN_LOOPS = 3;

export async function getOpenLoops(profileKey) {
  const [missingCheckins, unresolvedDebates] = await Promise.all([
    getMissingCheckinLoops(profileKey),
    getUnresolvedDebateLoops(profileKey),
  ]);
  return [...missingCheckins, ...unresolvedDebates]
    .sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))
    .slice(0, MAX_OPEN_LOOPS);
}
