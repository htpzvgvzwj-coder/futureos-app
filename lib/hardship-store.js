import { query, pool } from "./db.js";

export async function getOrCreateSession(profileKey) {
  const existing = await query(
    "select * from hardship_sessions where profile_key = $1",
    [profileKey],
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await query(
    "insert into hardship_sessions (profile_key) values ($1) returning *",
    [profileKey],
  );
  return inserted.rows[0];
}

export async function getMessageHistory(sessionId, stage) {
  const result = await query(
    "select role, content from hardship_messages where session_id = $1 and stage = $2 order by seq asc",
    [sessionId, stage],
  );
  return result.rows.map((row) => ({ role: row.role, content: row.content }));
}

export async function appendMessages(sessionId, stage, messages) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      "select coalesce(max(seq), 0) as max_seq from hardship_messages where session_id = $1 and stage = $2",
      [sessionId, stage],
    );
    let seq = rows[0].max_seq;
    for (const message of messages) {
      seq += 1;
      await client.query(
        "insert into hardship_messages (session_id, stage, seq, role, content) values ($1, $2, $3, $4, $5)",
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
    "insert into hardship_artifacts (session_id, stage, artifact_type, payload) values ($1, $2, $3, $4)",
    [sessionId, stage, artifactType, JSON.stringify(payload)],
  );
}

export async function getLatestArtifact(sessionId, stage, artifactType) {
  const result = await query(
    `select payload from hardship_artifacts
     where session_id = $1 and stage = $2 and artifact_type = $3
     order by created_at desc limit 1`,
    [sessionId, stage, artifactType],
  );
  return result.rows[0]?.payload ?? null;
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
    `update hardship_sessions set ${sets.join(", ")}, updated_at = now() where id = $${values.length}`,
    values,
  );
}

export async function recordAppliedAction(
  hardshipSessionId,
  { actionType, targetDomain, amount, explanation, status = "applied", decisionType = "approve", decisionReason = null, proposedAmount = null }
) {
  const result = await query(
    `insert into hardship_actions_applied
       (hardship_session_id, action_type, target_domain, amount, explanation, status, decision_type, decision_reason, proposed_amount)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
    [hardshipSessionId, actionType, targetDomain ?? null, amount ?? null, explanation, status, decisionType, decisionReason, proposedAmount ?? amount ?? null],
  );
  return result.rows[0];
}

// A declined proposal is recorded, not silently dropped - Guardian should be able to tell
// later that this exact action was already offered and rejected (with why), instead of
// re-proposing it with no memory of the customer's answer.
export async function recordRejectedAction(hardshipSessionId, { actionType, targetDomain, proposedAmount, explanation, reason }) {
  const result = await query(
    `insert into hardship_actions_applied
       (hardship_session_id, action_type, target_domain, amount, explanation, status, decision_type, decision_reason, proposed_amount)
     values ($1, $2, $3, null, $4, 'rejected', 'reject', $5, $6) returning *`,
    [hardshipSessionId, actionType, targetDomain ?? null, explanation, reason ?? null, proposedAmount ?? null],
  );
  return result.rows[0];
}

export async function getAppliedActions(hardshipSessionId) {
  const result = await query(
    `select id, action_type, target_domain, amount, explanation, applied_at, status, decision_type, decision_reason, proposed_amount
     from hardship_actions_applied where hardship_session_id = $1 order by applied_at desc`,
    [hardshipSessionId],
  );
  return result.rows;
}
