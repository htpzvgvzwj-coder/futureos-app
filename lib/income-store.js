import { query } from "./db.js";

// Unlike a savings checkin (a cumulative contribution - see home-store.js's
// addSavingsCheckin), a month's real income is a single value, and a customer
// correcting an already-logged month is a normal case, not an edge case - so
// this upserts on (profile_key, entry_month) instead of a plain insert.
export async function upsertIncomeEntry(profileKey, { entryMonth, amount, note }) {
  const result = await query(
    `insert into income_entries (profile_key, entry_month, amount, note)
     values ($1, $2, $3, $4)
     on conflict (profile_key, entry_month)
     do update set amount = excluded.amount, note = excluded.note, created_at = now()
     returning id, entry_month, amount, note, created_at`,
    [profileKey, entryMonth, amount, note ?? null],
  );
  return result.rows[0];
}

export async function getIncomeHistory(profileKey, limit = 24) {
  const result = await query(
    `select id, entry_month, amount, note, created_at from income_entries
     where profile_key = $1 order by entry_month desc limit $2`,
    [profileKey, limit],
  );
  return result.rows;
}
