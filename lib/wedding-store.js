import { query, pool } from "./db.js";

// Single demo persona today — no auth/multi-user system exists in this app.
// Keeping this as a named constant (rather than scattering the literal
// string) makes it a one-line change if real user accounts are added later.
export const DEFAULT_PROFILE_KEY = "karina-demo";

export async function getOrCreateSession(profileKey) {
  const existing = await query(
    "select * from wedding_sessions where profile_key = $1",
    [profileKey],
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await query(
    "insert into wedding_sessions (profile_key) values ($1) returning *",
    [profileKey],
  );
  return inserted.rows[0];
}

export async function getMessageHistory(sessionId, stage) {
  const result = await query(
    "select role, content from wedding_messages where session_id = $1 and stage = $2 order by seq asc",
    [sessionId, stage],
  );
  return result.rows.map((row) => ({ role: row.role, content: row.content }));
}

// `messages` is an array of { role: "user" | "assistant", content: <Anthropic content-block array> }.
// Appended atomically with sequential `seq` numbers continuing from whatever is already stored.
export async function appendMessages(sessionId, stage, messages) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      "select coalesce(max(seq), 0) as max_seq from wedding_messages where session_id = $1 and stage = $2",
      [sessionId, stage],
    );
    let seq = rows[0].max_seq;
    for (const message of messages) {
      seq += 1;
      await client.query(
        "insert into wedding_messages (session_id, stage, seq, role, content) values ($1, $2, $3, $4, $5)",
        [sessionId, stage, seq, message.role, JSON.stringify(message.content)],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveArtifact(sessionId, stage, artifactType, payload) {
  await query(
    "insert into wedding_artifacts (session_id, stage, artifact_type, payload) values ($1, $2, $3, $4)",
    [sessionId, stage, artifactType, JSON.stringify(payload)],
  );
}

export async function getLatestArtifact(sessionId, stage, artifactType) {
  const result = await query(
    `select payload from wedding_artifacts
     where session_id = $1 and stage = $2 and artifact_type = $3
     order by created_at desc limit 1`,
    [sessionId, stage, artifactType],
  );
  return result.rows[0]?.payload ?? null;
}

export async function addSavingsCheckin(sessionId, { checkinMonth, amount, note }) {
  const result = await query(
    `insert into wedding_savings_checkins (session_id, checkin_month, amount, note)
     values ($1, $2, $3, $4) returning id, checkin_month, amount, note, created_at`,
    [sessionId, checkinMonth, amount, note ?? null],
  );
  return result.rows[0];
}

export async function getSavingsCheckins(sessionId) {
  const result = await query(
    `select id, checkin_month, amount, note, created_at from wedding_savings_checkins
     where session_id = $1 order by checkin_month asc, created_at asc`,
    [sessionId],
  );
  return result.rows;
}

export async function updateSessionStatus(sessionId, { stage1Status, stage2Status }) {
  const sets = [];
  const values = [];
  if (stage1Status) {
    values.push(stage1Status);
    sets.push(`stage1_status = $${values.length}`);
  }
  if (stage2Status) {
    values.push(stage2Status);
    sets.push(`stage2_status = $${values.length}`);
  }
  if (!sets.length) return;
  values.push(sessionId);
  await query(
    `update wedding_sessions set ${sets.join(", ")}, updated_at = now() where id = $${values.length}`,
    values,
  );
}
