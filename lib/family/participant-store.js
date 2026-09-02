// Private Constellation participant store. Two INDEPENDENT identities per
// family plan. Every write is scoped to the CALLER's own participant row -
// there is no code path that lets one identity write or read the other's
// private_view numbers. The redaction happens in
// private-constellation-finance.js#redactParticipantView.

import { query, withTransaction } from "../db.js";

function shortCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Get (or create) the family_plan row bound to a plans.id.
export async function ensureFamilyPlan({ planId, createdBy }) {
  const existing = await query("select * from family_plans where plan_id = $1", [planId]);
  if (existing.rows[0]) return existing.rows[0];
  const inserted = await query(
    "insert into family_plans (plan_id, created_by, invite_code) values ($1, $2, $3) returning *",
    [planId, createdBy, shortCode()],
  );
  return inserted.rows[0];
}

export async function listParticipants(familyPlanId) {
  const { rows } = await query(
    "select participant_key, role, display_name, private_view, confirmed, confirmed_at, joined_at from family_participants where family_plan_id = $1 order by joined_at asc",
    [familyPlanId],
  );
  return rows;
}

// Ensure the caller has a participant row. The plan creator is the
// `initiator`; anyone else joining via the invite code is a `partner`.
export async function ensureParticipant({ familyPlanId, participantKey, role, displayName = "" }) {
  const { rows } = await query(
    `insert into family_participants (family_plan_id, participant_key, role, display_name)
     values ($1, $2, $3, $4)
     on conflict (family_plan_id, participant_key) do update set updated_at = now()
     returning participant_key, role, display_name, confirmed`,
    [familyPlanId, participantKey, role, displayName],
  );
  return rows[0];
}

// Join by invite code (a second, independent identity). Refuses a third.
export async function joinByInviteCode({ inviteCode, participantKey, displayName = "" }) {
  return withTransaction(async (tx) => {
    const fp = await tx.query("select * from family_plans where invite_code = $1", [String(inviteCode || "").toUpperCase()]);
    const plan = fp.rows[0];
    if (!plan) return { ok: false, error: "invalid_invite_code" };
    const parts = await tx.query("select participant_key from family_participants where family_plan_id = $1", [plan.id]);
    const already = parts.rows.some((p) => p.participant_key === participantKey);
    if (!already && parts.rows.length >= 2) return { ok: false, error: "family_plan_full" };
    await tx.query(
      `insert into family_participants (family_plan_id, participant_key, role, display_name)
       values ($1, $2, 'partner', $3)
       on conflict (family_plan_id, participant_key) do update set display_name = excluded.display_name, updated_at = now()`,
      [plan.id, participantKey, displayName],
    );
    if (parts.rows.length + (already ? 0 : 1) >= 2) {
      await tx.query("update family_plans set status = 'both_joined', updated_at = now() where id = $1", [plan.id]);
    }
    return { ok: true, familyPlanId: plan.id, planId: plan.plan_id };
  });
}

// Write ONLY the caller's own private view. `confirm` toggles their
// confirmation. There is no parameter that targets another participant.
export async function saveOwnView({ familyPlanId, participantKey, privateView, confirm = false }) {
  const { rows } = await query(
    `update family_participants
       set private_view = $3::jsonb,
           confirmed = $4,
           confirmed_at = case when $4 then now() else confirmed_at end,
           updated_at = now()
     where family_plan_id = $1 and participant_key = $2
     returning participant_key, role, confirmed`,
    [familyPlanId, participantKey, JSON.stringify(privateView ?? {}), Boolean(confirm)],
  );
  return rows[0] ?? null;
}
