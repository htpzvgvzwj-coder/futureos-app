import { query } from "./db.js";

// One row per document review - no sessions/messages table, same reasoning
// as lib/decision-store.js (single one-shot read, not a multi-turn
// conversation).
export async function saveReview(profileKey, { documentType, extractedText, summary, flaggedClauses, keyFacts }) {
  const result = await query(
    `insert into document_reviews (profile_key, document_type, extracted_text, summary, flagged_clauses, key_facts)
     values ($1, $2, $3, $4, $5, $6)
     returning id, created_at`,
    [profileKey, documentType, extractedText, summary, JSON.stringify(flaggedClauses), JSON.stringify(keyFacts)],
  );
  return { id: result.rows[0].id, createdAt: result.rows[0].created_at.toISOString() };
}

export async function getReviewHistory(profileKey, limit = 20) {
  const result = await query(
    `select id, document_type, summary, flagged_clauses, key_facts, created_at
     from document_reviews
     where profile_key = $1
     order by created_at desc
     limit $2`,
    [profileKey, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    documentType: row.document_type,
    summary: row.summary,
    flaggedClauses: row.flagged_clauses,
    keyFacts: row.key_facts,
    createdAt: row.created_at.toISOString(),
  }));
}
