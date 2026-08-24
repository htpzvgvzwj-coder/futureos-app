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
       (profile_key, goal_type, situation, future_score, risk_level, bull_case, bear_case, bear_risk_tag, bull_rebuttal, judge_synthesis, recommended_action, confidence, context, ai_provider)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
      debate.bullRebuttal ?? null,
      debate.judgeSynthesis,
      debate.recommendedAction,
      debate.confidence,
      debate.context ? JSON.stringify(debate.context) : null,
      debate.aiProvider ?? null,
    ]
  );
  return result.rows[0];
}

export async function confirmDebate(profileKey, debateId, customerRebuttal = null) {
  const result = await query(
    `update mirror_debates
     set confirmed = true, confirmed_at = now(), customer_rebuttal = $3
     where id = $1 and profile_key = $2 returning *`,
    [debateId, profileKey, customerRebuttal]
  );
  return result.rows[0] ?? null;
}

// Real request for a Relationship Manager follow-up on this specific debate -
// gated client-side on the AI's own confidence field being "low", not a
// trust-tier or autonomy check (asking for human help should never require
// having already earned trust; if anything it matters most for customers who
// haven't). The debate's already-persisted `context` (see app/api/mirror/
// debate/route.js) is what makes the handoff preserve real numbers instead
// of the customer repeating their situation from scratch.
export async function escalateDebate(profileKey, debateId) {
  const result = await query(
    `update mirror_debates set escalation_requested = true, escalation_requested_at = now() where id = $1 and profile_key = $2 returning *`,
    [debateId, profileKey]
  );
  return result.rows[0] ?? null;
}

// Single-debate lookup for the instant what-if recompute (app/api/mirror/
// whatif/route.js) - needs the exact real inputs/computed this ONE debate
// was generated from (debate.context), not the whole recent list.
export async function getDebateById(profileKey, debateId) {
  const result = await query(`select * from mirror_debates where id = $1 and profile_key = $2`, [debateId, profileKey]);
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

// Customer Calibration Score's real data source: debates where the customer
// wrote a rebuttal (proceeding despite a flagged risk) AND a real outcome has
// since resolved. "Held up" means the risk did not materialize - the same
// ground truth getResolvedDebateStats checks the AI's own recommendation
// against, just scored from the customer's side of the disagreement instead.
export async function getCustomerCalibrationStats(profileKey) {
  const result = await query(
    `select resolved_outcome from mirror_debates
     where profile_key = $1 and customer_rebuttal is not null
       and resolved_outcome in ('risk_materialized', 'risk_did_not_materialize')`,
    [profileKey]
  );
  const heldUpCount = result.rows.filter((row) => row.resolved_outcome === "risk_did_not_materialize").length;
  return { resolvedCount: result.rows.length, heldUpCount };
}

// Recent resolved rebuttals for a real, readable "Your Track Record" list -
// getCustomerCalibrationStats above gives the aggregate number, this gives
// the actual evidence behind it (what the customer said, what happened).
export async function getRecentCalibratedDebates(profileKey, limit = 5) {
  const result = await query(
    `select id, goal_type, bear_case, customer_rebuttal, resolved_outcome, resolved_at
     from mirror_debates
     where profile_key = $1 and customer_rebuttal is not null
       and resolved_outcome in ('risk_materialized', 'risk_did_not_materialize')
     order by resolved_at desc limit $2`,
    [profileKey, limit]
  );
  return result.rows;
}
