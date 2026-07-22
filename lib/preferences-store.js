import { query } from "./db.js";

export async function getPreferences(userId) {
  const result = await query(`select data from user_preferences where user_id = $1`, [userId]);
  return result.rows[0]?.data ?? null;
}

export async function savePreferences(userId, data) {
  await query(
    `insert into user_preferences (user_id, data, updated_at) values ($1, $2, now())
     on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
    [userId, JSON.stringify(data)]
  );
}
