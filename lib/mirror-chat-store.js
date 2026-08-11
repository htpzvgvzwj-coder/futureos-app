import { query, pool } from "./db.js";

// Mirrors lib/wedding-store.js's getOrCreateSession/getMessageHistory/
// appendMessages exactly, minus the `stage` column - Mirror chat is one
// continuous thread, not a stage1/stage2 split.

export async function getOrCreateSession(profileKey) {
  const existing = await query("select * from mirror_chat_sessions where profile_key = $1", [profileKey]);
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await query(
    "insert into mirror_chat_sessions (profile_key) values ($1) returning *",
    [profileKey],
  );
  return inserted.rows[0];
}

export async function getMessageHistory(sessionId) {
  const result = await query(
    "select role, content, tool_results from mirror_chat_messages where session_id = $1 order by seq asc",
    [sessionId],
  );
  return result.rows.map((row) => ({ role: row.role, content: row.content, toolResults: row.tool_results }));
}

// `messages` is an array of { role: "user" | "assistant", content: <Anthropic content-block array>, toolResults?: <real run_debate results from this turn> }.
// Appended atomically with sequential `seq` numbers continuing from whatever is already stored.
export async function appendMessages(sessionId, messages) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      "select coalesce(max(seq), 0) as max_seq from mirror_chat_messages where session_id = $1",
      [sessionId],
    );
    let seq = rows[0].max_seq;
    for (const message of messages) {
      seq += 1;
      await client.query(
        "insert into mirror_chat_messages (session_id, seq, role, content, tool_results) values ($1, $2, $3, $4, $5)",
        [sessionId, seq, message.role, JSON.stringify(message.content), message.toolResults ? JSON.stringify(message.toolResults) : null],
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
