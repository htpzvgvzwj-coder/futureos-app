import { query } from "./db.js";

// Real, structured, revocable commitment - see scripts/migrate.sql's
// goal_commitments table comment for why this exists alongside (not
// instead of) home_artifacts' confirmed_savings_plan. Same shape as every
// other *-store.js in this codebase.
export async function createCommitment(
  profileKey,
  {
    domain,
    monthlyContribution,
    effectiveMonth,
    pauseIfEmergencyMonthsBelow,
    sourceMoment,
    supersededSavingsPlan = null,
    priorMonthlyContribution = null,
    planId = null,
    planBranchId = null,
  },
) {
  try {
    const result = await query(
      `insert into goal_commitments
         (profile_key, domain, monthly_contribution, effective_month, pause_if_emergency_months_below,
          source_moment, superseded_savings_plan, prior_monthly_contribution, plan_id, plan_branch_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        profileKey,
        domain,
        monthlyContribution,
        effectiveMonth,
        pauseIfEmergencyMonthsBelow,
        JSON.stringify(sourceMoment ?? {}),
        supersededSavingsPlan ? JSON.stringify(supersededSavingsPlan) : null,
        priorMonthlyContribution,
        planId,
        planBranchId,
      ],
    );
    return result.rows[0];
  } catch (error) {
    // goal_commitments_one_active_per_domain (partial unique index) - a
    // second active commitment for the same (profile, domain) before the
    // first is revoked. Surface a real, typed conflict the route turns into
    // a 409 rather than a raw 500.
    if (error?.code === "23505") {
      const conflict = new Error("active_commitment_exists");
      conflict.code = "ACTIVE_COMMITMENT_EXISTS";
      throw conflict;
    }
    throw error;
  }
}

export async function getActiveCommitment(profileKey, domain) {
  const result = await query(
    `select * from goal_commitments where profile_key = $1 and domain = $2 and status = 'active' order by created_at desc limit 1`,
    [profileKey, domain]
  );
  return result.rows[0] ?? null;
}

export async function getCommitmentById(id, profileKey) {
  const result = await query(
    `select * from goal_commitments where id = $1 and profile_key = $2 limit 1`,
    [id, profileKey],
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

// Guardian Phase 3 — pause / resume / reduce a commitment (a collision path
// or a recovery step). Reduce is revoke + recreate at the lower amount so
// the audit chain stays intact.
export async function pauseCommitment(id, profileKey, { reason = null } = {}) {
  const result = await query(
    `update goal_commitments set status = 'paused', paused_at = now(), pause_reason = $3
     where id = $1 and profile_key = $2 and status = 'active' returning *`,
    [id, profileKey, reason],
  );
  return result.rows[0] ?? null;
}

export async function resumeCommitment(id, profileKey) {
  const result = await query(
    `update goal_commitments set status = 'active', paused_at = null, pause_reason = null
     where id = $1 and profile_key = $2 and status = 'paused' returning *`,
    [id, profileKey],
  );
  return result.rows[0] ?? null;
}

export async function reduceCommitment(id, profileKey, newMonthly) {
  const cur = await getCommitmentById(id, profileKey);
  if (!cur || cur.status !== "active") return null;
  const nextMonthly = Math.max(0, Math.round(Number(newMonthly) || 0));
  await revokeCommitment(id, profileKey);
  if (nextMonthly === 0) return { revoked: true, from: Number(cur.monthly_contribution), to: 0 };
  const fresh = await createCommitment(profileKey, {
    domain: cur.domain,
    monthlyContribution: nextMonthly,
    effectiveMonth: cur.effective_month,
    pauseIfEmergencyMonthsBelow: cur.pause_if_emergency_months_below,
    sourceMoment: { trigger: "guardian_collision_path", from: id },
    priorMonthlyContribution: Number(cur.monthly_contribution),
    planId: cur.plan_id,
    planBranchId: cur.plan_branch_id,
  });
  return { ...fresh, from: Number(cur.monthly_contribution), to: nextMonthly };
}
