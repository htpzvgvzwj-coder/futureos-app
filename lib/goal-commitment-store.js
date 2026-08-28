import { query } from "./db.js";

// Real, structured, revocable commitment - see scripts/migrate.sql's
// goal_commitments table comment for why this exists alongside (not
// instead of) home_artifacts' confirmed_savings_plan. Same shape as every
// other *-store.js in this codebase.
export async function createCommitment(profileKey, { domain, monthlyContribution, effectiveMonth, pauseIfEmergencyMonthsBelow, sourceMoment }) {
  const result = await query(
    `insert into goal_commitments (profile_key, domain, monthly_contribution, effective_month, pause_if_emergency_months_below, source_moment)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [profileKey, domain, monthlyContribution, effectiveMonth, pauseIfEmergencyMonthsBelow, JSON.stringify(sourceMoment ?? {})]
  );
  return result.rows[0];
}

export async function getActiveCommitment(profileKey, domain) {
  const result = await query(
    `select * from goal_commitments where profile_key = $1 and domain = $2 and status = 'active' order by created_at desc limit 1`,
    [profileKey, domain]
  );
  return result.rows[0] ?? null;
}

export async function revokeCommitment(id, profileKey) {
  const result = await query(
    `update goal_commitments set status = 'revoked', revoked_at = now()
     where id = $1 and profile_key = $2 and status = 'active'
     returning *`,
    [id, profileKey]
  );
  return result.rows[0] ?? null;
}
