import { query } from "./db.js";

// Every debate run is saved (confirmed: false) the moment it's generated, not
// only once the customer acts on it - "confirmed" distinguishes a plan the
// customer committed to from one they only previewed. The bear case's
// bear_risk_tag is what a future job would check against reality (did an
// income disruption / rate increase actually happen) to feed Guardian
// Reputation Score - a debate that renders and vanishes on the client would
// have nothing left to check later.
export async function saveDebate(profileKey, debate) {
  const result = await query(
    `insert into mirror_debates
       (profile_key, goal_type, situation, future_score, risk_level, bull_case, bear_case, bear_risk_tag, judge_synthesis, recommended_action, confidence)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning *`,
    [
      profileKey,
      debate.goalType,
      debate.situation ?? null,
      debate.futureScore,
      debate.riskLevel,
      debate.bullCase,
      debate.bearCase,
      debate.bearRiskTag,
      debate.judgeSynthesis,
      debate.recommendedAction,
      debate.confidence,
    ]
  );
  return result.rows[0];
}

export async function confirmDebate(profileKey, debateId) {
  const result = await query(
    `update mirror_debates set confirmed = true, confirmed_at = now() where id = $1 and profile_key = $2 returning *`,
    [debateId, profileKey]
  );
  return result.rows[0] ?? null;
}

export async function getRecentDebates(profileKey, limit = 20) {
  const result = await query(
    `select * from mirror_debates where profile_key = $1 order by created_at desc limit $2`,
    [profileKey, limit]
  );
  return result.rows;
}

// Confirmed debates still waiting on a real-world verdict - the resolver
// (lib/mirror-outcome-resolver.js) checks each of these against real hardship
// evidence dated after confirmed_at.
export async function getUnresolvedConfirmedDebates(profileKey) {
  const result = await query(
    `select * from mirror_debates
     where profile_key = $1 and confirmed = true and resolved_outcome is null
     order by confirmed_at asc`,
    [profileKey]
  );
  return result.rows;
}

export async function setResolvedOutcome(debateId, outcome) {
  const result = await query(
    `update mirror_debates set resolved_outcome = $1, resolved_at = now() where id = $2 returning *`,
    [outcome, debateId]
  );
  return result.rows[0] ?? null;
}

// Only risk_materialized/risk_did_not_materialize rows have a real ground truth to
// judge the Judge's synthesis against - insufficient_signal rows (bear_risk_tag types
// this app has no real data source to check, e.g. rate_increase/market_downturn) are
// excluded rather than guessed into either bucket.
export async function getResolvedDebateStats(profileKey) {
  const result = await query(
    `select recommended_action, resolved_outcome from mirror_debates
     where profile_key = $1 and resolved_outcome in ('risk_materialized', 'risk_did_not_materialize')`,
    [profileKey]
  );
  const cautious = new Set(["wait", "reconsider"]);
  let correct = 0;
  for (const row of result.rows) {
    const judgedCautious = cautious.has(row.recommended_action);
    const wasRight = row.resolved_outcome === "risk_materialized" ? judgedCautious : !judgedCautious;
    if (wasRight) correct += 1;
  }
  return { resolvedCount: result.rows.length, correctCount: correct };
}
