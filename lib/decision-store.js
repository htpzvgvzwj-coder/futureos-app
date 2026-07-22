import { query } from "./db.js";

// Single demo persona today — no auth/multi-user system exists in this app. Unlike every other
// *-store.js in this codebase, Quick Verdict has no multi-turn conversation or confirm/finalize
// lifecycle (it's a single deterministic-then-narrated answer per check), so there's no sessions or
// messages table — just one row per check, directly keyed by profile_key (a real user id).

export async function saveCheck(profileKey, { description, verdict, narrative, keyConsideration, mocked }) {
  const result = await query(
    `insert into decision_checks
       (profile_key, description, amount, recurring_monthly, verdict, numbers, narrative, key_consideration, mocked)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, created_at`,
    [
      profileKey,
      description,
      verdict.amount,
      verdict.recurring_monthly,
      verdict.verdict,
      JSON.stringify(verdict),
      narrative,
      keyConsideration,
      mocked,
    ],
  );
  return { id: result.rows[0].id, createdAt: result.rows[0].created_at.toISOString() };
}

export async function getHistory(profileKey, limit = 20) {
  const result = await query(
    `select id, description, amount, recurring_monthly, verdict, numbers, narrative, key_consideration, mocked, created_at
     from decision_checks
     where profile_key = $1
     order by created_at desc
     limit $2`,
    [profileKey, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    recurringMonthly: Number(row.recurring_monthly),
    verdict: row.verdict,
    numbers: row.numbers,
    narrative: row.narrative,
    keyConsideration: row.key_consideration,
    mocked: row.mocked,
    createdAt: row.created_at.toISOString(),
  }));
}
