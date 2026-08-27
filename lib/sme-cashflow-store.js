import { query } from "./db.js";

// One profile per customer - the business owner's own real recurring
// income/expense events, updated in place (not a session/history
// lifecycle) - matches user_preferences' own upsert convention, since
// this is a real ongoing profile the owner edits, not a one-shot check.
export async function getProfile(profileKey) {
  const result = await query(
    `select business_name, starting_cash, events, narrative, key_consideration, mocked, updated_at
     from sme_cashflow_profiles where profile_key = $1`,
    [profileKey],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    businessName: row.business_name,
    startingCash: Number(row.starting_cash),
    events: row.events,
    narrative: row.narrative,
    keyConsideration: row.key_consideration,
    mocked: row.mocked,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function saveProfile(profileKey, { businessName, startingCash, events, narrative, keyConsideration, mocked }) {
  const result = await query(
    `insert into sme_cashflow_profiles (profile_key, business_name, starting_cash, events, narrative, key_consideration, mocked)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (profile_key) do update set
       business_name = excluded.business_name,
       starting_cash = excluded.starting_cash,
       events = excluded.events,
       narrative = excluded.narrative,
       key_consideration = excluded.key_consideration,
       mocked = excluded.mocked,
       updated_at = now()
     returning updated_at`,
    [profileKey, businessName, startingCash, JSON.stringify(events), narrative, keyConsideration, mocked],
  );
  return result.rows[0].updated_at.toISOString();
}
