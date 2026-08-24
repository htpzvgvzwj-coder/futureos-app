import { query } from "./db.js";
import { checkCrossGoalRisk } from "./cross-goal-context.js";

// Real, persisted proactive alert - same shape as every other *-store.js in
// this codebase. See scripts/migrate.sql's guardian_alerts table comment
// for why this exists (no persisted, screen-independent alert channel
// existed anywhere in the app before this).
export async function createAlert(profileKey, { alertType, domain, severity, detail }) {
  const result = await query(
    `insert into guardian_alerts (profile_key, alert_type, domain, severity, detail)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [profileKey, alertType, domain ?? null, severity, JSON.stringify(detail ?? {})]
  );
  return result.rows[0];
}

export async function listOpenAlerts(profileKey) {
  const result = await query(
    `select * from guardian_alerts where profile_key = $1 and status = 'open' order by created_at desc`,
    [profileKey]
  );
  return result.rows;
}

// Shared post-confirm hook for all 6 domain confirm routes (wedding/home/
// retirement/other stage2 finalize, loan confirm, investment confirm):
// runs the real deterministic cross-goal risk check and creates an alert
// if triggered. Never throws - a bug in this side-effect must never fail
// the customer's actual confirm action, which is why every call site wraps
// this in nothing further and just awaits it directly.
export async function triggerCrossGoalCheck(profileKey, domain, { monthlyIncome, monthlyExpenses, currentSavings }) {
  try {
    const risk = await checkCrossGoalRisk(profileKey, { monthlyIncome, monthlyExpenses, currentSavings });
    if (!risk.triggered) return null;
    const severity =
      risk.utilizationPercent > 90 ||
      risk.worseningLoans.some((loan) => loan.delta <= -15) ||
      risk.worseningInvestments.some((pick) => pick.delta <= -15)
        ? "atRisk"
        : "monitoring";
    return await createAlert(profileKey, { alertType: "cross_goal_risk", domain, severity, detail: risk });
  } catch (error) {
    console.error("triggerCrossGoalCheck failed (non-fatal, confirm still succeeds)", error);
    return null;
  }
}

export async function dismissAlert(id, profileKey) {
  const result = await query(
    `update guardian_alerts set status = 'dismissed', dismissed_at = now()
     where id = $1 and profile_key = $2 and status = 'open'
     returning *`,
    [id, profileKey]
  );
  return result.rows[0] ?? null;
}
