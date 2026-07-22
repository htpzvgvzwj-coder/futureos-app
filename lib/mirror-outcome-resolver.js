// Closes Future Mirror's debate accountability loop: did the bear case's
// flagged risk actually happen? Checked against the only real "did something
// bad happen" signal this app has - real hardship evidence (a later hardship
// assessment, or a real pause/reduce applied to the same goal) - never
// guessed. bear_risk_tag values this app has no real data source for
// (rate_increase, market_downturn, other) are honestly left as
// "insufficient_signal" rather than resolved either way.
import { getUnresolvedConfirmedDebates, setResolvedOutcome } from "./mirror-store.js";
import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import * as hardshipStore from "./hardship-store.js";

const DOMAIN_STORES = { wedding: weddingStore, home: homeStore, retirement: retirementStore };
const CHECKABLE_TAGS = new Set(["income_disruption", "expense_shock", "timeline_slip"]);

// Only conclude "did not materialize" once enough real time has passed that a
// customer would plausibly have reported a hardship by now if one had
// happened - never the instant a debate is confirmed. Deliberately not tuned
// shorter just to make a demo resolve faster - that would be the same kind of
// guessing this resolver exists to avoid.
const RESOLUTION_WINDOW_DAYS = 90;

function matchesRiskTag(bearRiskTag, hardshipType) {
  if (bearRiskTag === "income_disruption") return hardshipType === "income_reduction" || hardshipType === "job_loss";
  if (bearRiskTag === "expense_shock") return hardshipType === "one_time_expense";
  return false;
}

export async function resolveDebateOutcomes(profileKey, { now = new Date() } = {}) {
  const unresolved = await getUnresolvedConfirmedDebates(profileKey);
  if (!unresolved.length) return { resolvedNow: 0, checked: 0 };

  const hardshipSession = await hardshipStore.getOrCreateSession(profileKey);
  const [assessments, appliedActions] = await Promise.all([
    hardshipStore.getAllArtifactsWithTimestamps(hardshipSession.id, "stage1", "hardship_assessment"),
    hardshipStore.getAppliedActions(hardshipSession.id),
  ]);

  let resolvedNow = 0;

  for (const debate of unresolved) {
    if (!CHECKABLE_TAGS.has(debate.bear_risk_tag) || !DOMAIN_STORES[debate.goal_type]) {
      await setResolvedOutcome(debate.id, "insufficient_signal");
      resolvedNow += 1;
      continue;
    }

    const confirmedAt = new Date(debate.confirmed_at);

    const materialized =
      debate.bear_risk_tag === "timeline_slip"
        ? appliedActions.some(
            (action) =>
              action.target_domain === debate.goal_type &&
              (action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan") &&
              action.status === "applied" &&
              new Date(action.applied_at) > confirmedAt
          )
        : assessments.some(
            (entry) => new Date(entry.createdAt) > confirmedAt && matchesRiskTag(debate.bear_risk_tag, entry.payload.hardship_type)
          );

    if (materialized) {
      await setResolvedOutcome(debate.id, "risk_materialized");
      resolvedNow += 1;
      continue;
    }

    const daysSinceConfirmed = (now.getTime() - confirmedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceConfirmed >= RESOLUTION_WINDOW_DAYS) {
      await setResolvedOutcome(debate.id, "risk_did_not_materialize");
      resolvedNow += 1;
    }
    // else: too soon to tell either way - stays unresolved until a later check.
  }

  return { resolvedNow, checked: unresolved.length };
}
