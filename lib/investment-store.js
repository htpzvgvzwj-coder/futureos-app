import { query, pool } from "./db.js";

// Single demo persona today — no auth/multi-user system exists in this app.
export const DEFAULT_PROFILE_KEY = "karina-demo";

// Plain profile_key-unique session, like wedding/home/retirement — not
// loan's (profile_key, purpose) keying. Investment Planner is one ongoing
// "how to allocate available cashflow" conversation, not concurrent
// independent slots the way a renovation loan and a home loan are.
export async function getOrCreateSession(profileKey) {
  const existing = await query(
    "select * from investment_sessions where profile_key = $1",
    [profileKey],
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await query(
    "insert into investment_sessions (profile_key) values ($1) returning *",
    [profileKey],
  );
  return inserted.rows[0];
}

export async function getMessageHistory(sessionId, stage) {
  const result = await query(
    "select role, content from investment_messages where session_id = $1 and stage = $2 order by seq asc",
    [sessionId, stage],
  );
  return result.rows.map((row) => ({ role: row.role, content: row.content }));
}

export async function appendMessages(sessionId, stage, messages) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      "select coalesce(max(seq), 0) as max_seq from investment_messages where session_id = $1 and stage = $2",
      [sessionId, stage],
    );
    let seq = rows[0].max_seq;
    for (const message of messages) {
      seq += 1;
      await client.query(
        "insert into investment_messages (session_id, stage, seq, role, content) values ($1, $2, $3, $4, $5)",
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

// Returns the row's real created_at (ISO string) — no existing caller reads
// this function's return value, so adding it is purely additive. Lets
// confirm routes surface a genuine "when did this happen" timestamp for
// relationship-memory events.
export async function saveArtifact(sessionId, stage, artifactType, payload) {
  const result = await query(
    "insert into investment_artifacts (session_id, stage, artifact_type, payload) values ($1, $2, $3, $4) returning created_at",
    [sessionId, stage, artifactType, JSON.stringify(payload)],
  );
  return result.rows[0].created_at.toISOString();
}

export async function getLatestArtifact(sessionId, stage, artifactType) {
  const result = await query(
    `select payload from investment_artifacts
     where session_id = $1 and stage = $2 and artifact_type = $3
     order by created_at desc limit 1`,
    [sessionId, stage, artifactType],
  );
  return result.rows[0]?.payload ?? null;
}

// Unlike every other domain's store, confirmed picks here ACCUMULATE — a
// customer can confirm more than one instrument in the same investment
// session (a basket, not a single confirmed plan) — so reads need every
// row, not just the latest.
export async function getAllArtifacts(sessionId, stage, artifactType) {
  const result = await query(
    `select payload, created_at from investment_artifacts
     where session_id = $1 and stage = $2 and artifact_type = $3
     order by created_at asc`,
    [sessionId, stage, artifactType],
  );
  return result.rows.map((row) => row.payload);
}

// Same read as getAllArtifacts but also returns each row's real created_at —
// added for Strategic Balance's cross-domain dashboard (lib/strategic-balance-context.js),
// which needs genuine confirmation dates, not just payloads.
export async function getAllArtifactsWithTimestamps(sessionId, stage, artifactType) {
  const result = await query(
    `select payload, created_at from investment_artifacts
     where session_id = $1 and stage = $2 and artifact_type = $3
     order by created_at asc`,
    [sessionId, stage, artifactType],
  );
  return result.rows.map((row) => ({ payload: row.payload, createdAt: row.created_at.toISOString() }));
}

export async function updateSessionStatus(sessionId, { stage1Status }) {
  if (!stage1Status) return;
  await query(
    "update investment_sessions set stage1_status = $1, updated_at = now() where id = $2",
    [stage1Status, sessionId],
  );
}
