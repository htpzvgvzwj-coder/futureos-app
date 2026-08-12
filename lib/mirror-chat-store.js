import { query, pool } from "./db.js";

// Mirrors lib/wedding-store.js's getOrCreateSession/getMessageHistory/
// appendMessages exactly, minus the `stage` column - Mirror chat is one
// continuous thread, not a stage1/stage2 split.

// Atomic upsert, not check-then-insert - see lib/wedding-store.js's
// identical fix for why (a real race, not theoretical).
export async function getOrCreateSession(profileKey) {
  const result = await query(
    `insert into mirror_chat_sessions (profile_key) values ($1)
     on conflict (profile_key) do update set profile_key = excluded.profile_key
     returning *`,
    [profileKey],
  );
  return result.rows[0];
}

export async function getMessageHistory(sessionId) {
  const result = await query(
    "select role, content, tool_results, context from mirror_chat_messages where session_id = $1 order by seq asc",
    [sessionId],
  );
  return result.rows.map((row) => ({ role: row.role, content: row.content, toolResults: row.tool_results, context: row.context }));
}

// `messages` is an array of { role: "user" | "assistant", content: <Anthropic content-block array>, toolResults?: <real run_debate results from this turn>, context?: <real baseInputs/language this reply was generated from - "why did I say that" trace> }.
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
        "insert into mirror_chat_messages (session_id, seq, role, content, tool_results, context) values ($1, $2, $3, $4, $5, $6)",
        [
          sessionId,
          seq,
          message.role,
          JSON.stringify(message.content),
          message.toolResults ? JSON.stringify(message.toolResults) : null,
          message.context ? JSON.stringify(message.context) : null,
        ],
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
