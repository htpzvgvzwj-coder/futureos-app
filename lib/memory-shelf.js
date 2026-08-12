import { query } from "./db.js";

// `table`/`types` below are hardcoded literals in this module-level array,
// never derived from request input - safe to interpolate into the query
// text (not a SQL-injection surface).
const ARTIFACT_DOMAINS = [
  { domain: "wedding", table: "wedding", types: ["confirmed_budget", "confirmed_savings_plan"] },
  { domain: "home", table: "home", types: ["confirmed_plan", "confirmed_savings_plan"] },
  { domain: "retirement", table: "retirement", types: ["confirmed_plan", "confirmed_savings_plan"] },
  { domain: "other", table: "other", types: ["confirmed_goal_plan", "confirmed_savings_plan"] },
  { domain: "loan", table: "loan", types: ["confirmed_loan"] },
  { domain: "investment", table: "investment", types: ["confirmed_investment_pick"] },
];

async function getArtifactMemories(profileKey) {
  const results = await Promise.all(
    ARTIFACT_DOMAINS.map(async ({ domain, table, types }) => {
      const result = await query(
        `select a.artifact_type, a.created_at
         from ${table}_artifacts a
         join ${table}_sessions s on s.id = a.session_id
         where s.profile_key = $1 and a.artifact_type = any($2::text[])
         order by a.created_at desc
         limit 5`,
        [profileKey, types]
      );
      return result.rows.map((row) => ({ type: "confirmed_plan", domain, detail: row.artifact_type, date: row.created_at }));
    })
  );
  return results.flat();
}

async function getHardshipMemories(profileKey) {
  const result = await query(
    `select a.action_type, a.applied_at
     from hardship_actions_applied a
     join hardship_sessions s on s.id = a.hardship_session_id
     where s.profile_key = $1 and a.status = 'applied'
     order by a.applied_at desc
     limit 5`,
    [profileKey]
  );
  return result.rows.map((row) => ({ type: "hardship_action", domain: "hardship", detail: row.action_type, date: row.applied_at }));
}

async function getDecisionMemories(profileKey) {
  const result = await query(
    `select verdict, created_at from decision_checks where profile_key = $1 order by created_at desc limit 5`,
    [profileKey]
  );
  return result.rows.map((row) => ({ type: "decision_check", domain: "decision", detail: row.verdict, date: row.created_at }));
}

async function getDocumentMemories(profileKey) {
  const result = await query(
    `select document_type, created_at from document_reviews where profile_key = $1 order by created_at desc limit 5`,
    [profileKey]
  );
  return result.rows.map((row) => ({ type: "document_review", domain: "decode-document", detail: row.document_type, date: row.created_at }));
}

async function getIncomeMemories(profileKey) {
  const result = await query(
    `select entry_month, created_at from income_entries where profile_key = $1 order by created_at desc limit 5`,
    [profileKey]
  );
  return result.rows.map((row) => ({ type: "income_entry", domain: "income", detail: row.entry_month, date: row.created_at }));
}

async function getDebateMemories(profileKey) {
  const result = await query(
    `select goal_type, confirmed_at, created_at from mirror_debates where profile_key = $1 and confirmed = true order by confirmed_at desc limit 5`,
    [profileKey]
  );
  return result.rows.map((row) => ({ type: "mirror_debate", domain: "mirror", detail: row.goal_type, date: row.confirmed_at ?? row.created_at }));
}

// Deliberately 9, not 3 - matches 2BB's own reasoning: enough real entries
// to show breadth of what's tracked (many different real types), not just
// the single most recent category.
const MAX_MEMORIES = 9;

export async function getRecentMemories(profileKey, limit = MAX_MEMORIES) {
  const [artifacts, hardship, decisions, documents, income, debates] = await Promise.all([
    getArtifactMemories(profileKey),
    getHardshipMemories(profileKey),
    getDecisionMemories(profileKey),
    getDocumentMemories(profileKey),
    getIncomeMemories(profileKey),
    getDebateMemories(profileKey),
  ]);
  return [...artifacts, ...hardship, ...decisions, ...documents, ...income, ...debates]
    .filter((entry) => entry.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}
