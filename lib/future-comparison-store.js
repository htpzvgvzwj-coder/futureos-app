import { query } from "./db.js";

// Same shape/role as lib/decision-store.js's decision_checks - one row per real comparison run,
// no multi-turn conversation lifecycle.
export async function saveComparison(profileKey, { description, comparison, narrative, keyConsideration, mocked }) {
  const result = await query(
    `insert into future_comparisons
       (profile_key, description, amount, recurring_monthly, horizon_months, numbers, narrative, key_consideration, mocked)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, created_at`,
    [
      profileKey,
      description,
      comparison.amount,
      comparison.recurringMonthly,
      comparison.horizonMonths,
      JSON.stringify(comparison),
      narrative,
      keyConsideration,
      mocked,
    ],
  );
  return { id: result.rows[0].id, createdAt: result.rows[0].created_at.toISOString() };
}

export async function getHistory(profileKey, limit = 20) {
  const result = await query(
    `select id, description, amount, recurring_monthly, horizon_months, numbers, narrative, key_consideration, mocked, created_at
     from future_comparisons
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
    horizonMonths: row.horizon_months,
    comparison: row.numbers,
    narrative: row.narrative,
    keyConsideration: row.key_consideration,
    mocked: row.mocked,
    createdAt: row.created_at.toISOString(),
  }));
}
