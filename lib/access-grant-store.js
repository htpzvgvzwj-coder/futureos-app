import { query } from "./db.js";

// Real user-to-user consent (six-list idea #3). Two-sided by design: creating a
// grant leaves it 'pending' until the grantee explicitly accepts or declines -
// this is a real consent record, not one party silently subscribing to
// another's data. 'view_and_act' now dispatches real joint actions (see
// lib/joint-action-store.js) - it still never lets the grantee act alone, every
// joint action additionally requires the grantor's own separate confirmation.
export async function createGrant({ grantorUserId, granteeUserId, scope, accessLevel, expiresAt = null }) {
  const result = await query(
    `insert into access_grants (grantor_user_id, grantee_user_id, scope, access_level, expires_at)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [grantorUserId, granteeUserId, scope, accessLevel, expiresAt]
  );
  return result.rows[0];
}

export async function respondToGrant(grantId, granteeUserId, decision) {
  const status = decision === "accept" ? "active" : "declined";
  const result = await query(
    `update access_grants
     set status = $1, responded_at = now()
     where id = $2 and grantee_user_id = $3 and status = 'pending'
     returning *`,
    [status, grantId, granteeUserId]
  );
  return result.rows[0] ?? null;
}

export async function revokeGrant(grantId, grantorUserId) {
  const result = await query(
    `update access_grants
     set status = 'revoked', revoked_at = now()
     where id = $1 and grantor_user_id = $2 and status = 'active'
     returning *`,
    [grantId, grantorUserId]
  );
  return result.rows[0] ?? null;
}

export async function listGrantsGiven(grantorUserId) {
  const result = await query(
    `select ag.*, u.email as grantee_email, u.display_name as grantee_display_name
     from access_grants ag
     join users u on u.id = ag.grantee_user_id
     where ag.grantor_user_id = $1
     order by ag.granted_at desc`,
    [grantorUserId]
  );
  return result.rows;
}

export async function listGrantsReceived(granteeUserId) {
  const result = await query(
    `select ag.*, u.email as grantor_email, u.display_name as grantor_display_name
     from access_grants ag
     join users u on u.id = ag.grantor_user_id
     where ag.grantee_user_id = $1
     order by ag.granted_at desc`,
    [granteeUserId]
  );
  return result.rows;
}

// scope 'all' covers every domain - a grant scoped to a specific domain (e.g.
// 'wedding') only satisfies a check for that same domain.
export async function getActiveGrant(grantorUserId, granteeUserId, domain) {
  const result = await query(
    `select * from access_grants
     where grantor_user_id = $1 and grantee_user_id = $2 and status = 'active'
       and (expires_at is null or expires_at > now())
       and (scope = 'all' or scope = $3)
     order by granted_at desc
     limit 1`,
    [grantorUserId, granteeUserId, domain]
  );
  return result.rows[0] ?? null;
}
