import { query } from "./db.js";

// Idempotent get-or-create, same pattern as every domain's getOrCreateSession
// — the row is created the FIRST time anyone reads it, so "when did our
// relationship begin" is a genuine backend timestamp (not a client-invented
// date), even though there's no real signup/onboarding flow in this
// prototype to hang it off of.
export async function getOrCreateJourneyStart(profileKey) {
  const existing = await query(
    "select started_at from relationship_milestones where profile_key = $1",
    [profileKey],
  );
  if (existing.rows[0]) return existing.rows[0].started_at.toISOString();

  const inserted = await query(
    "insert into relationship_milestones (profile_key) values ($1) returning started_at",
    [profileKey],
  );
  return inserted.rows[0].started_at.toISOString();
}
