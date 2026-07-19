import { query, pool } from "./db.js";

// Single demo persona today — no auth/multi-user system exists in this app.
export const DEFAULT_PROFILE_KEY = "karina-demo";

// Unlike every other domain's single profile_key-scoped session, a customer
// can hold a confirmed loan per purpose at once (e.g. a renovation loan and
// a home loan simultaneously) — so the session key is (profileKey, purpose).
export async function getOrCreateSession(profileKey, purpose) {
  const existing = await query(
    "select * from loan_sessions where profile_key = $1 and purpose = $2",
    [profileKey, purpose],
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await query(
    "insert into loan_sessions (profile_key, purpose) values ($1, $2) returning *",
    [profileKey, purpose],
  );
  return inserted.rows[0];
}

export async function getMessageHistory(sessionId, stage) {
  const result = await query(
    "select role, content from loan_messages where session_id = $1 and stage = $2 order by seq asc",
    [sessionId, stage],
  );
  return result.rows.map((row) => ({ role: row.role, content: row.content }));
}

export async function appendMessages(sessionId, stage, messages) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      "select coalesce(max(seq), 0) as max_seq from loan_messages where session_id = $1 and stage = $2",
      [sessionId, stage],
    );
    let seq = rows[0].max_seq;
    for (const message of messages) {
      seq += 1;
      await client.query(
        "insert into loan_messages (session_id, stage, seq, role, content) values ($1, $2, $3, $4, $5)",
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
    "insert into loan_artifacts (session_id, stage, artifact_type, payload) values ($1, $2, $3, $4)",
    [sessionId, stage, artifactType, JSON.stringify(payload)],
  );
}

export async function getLatestArtifact(sessionId, stage, artifactType) {
  const result = await query(
    `select payload from loan_artifacts
     where session_id = $1 and stage = $2 and artifact_type = $3
     order by created_at desc limit 1`,
    [sessionId, stage, artifactType],
  );
  return result.rows[0]?.payload ?? null;
}

export async function updateSessionStatus(sessionId, { stage1Status }) {
  if (!stage1Status) return;
  await query(
    "update loan_sessions set stage1_status = $1, updated_at = now() where id = $2",
    [stage1Status, sessionId],
  );
}
