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
    `update mirror_debates set confirmed = true where id = $1 and profile_key = $2 returning *`,
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
