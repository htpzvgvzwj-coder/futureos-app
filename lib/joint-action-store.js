import { query } from "./db.js";
import { getActiveGrant } from "./access-grant-store.js";

// Dual consent for joint write-permission: the grant alone never lets the grantee
// act - proposing an action only creates a pending record here. Only dispatched
// once the target (whose data it affects) separately confirms.
export async function proposeJointAction({ initiatorUserId, targetUserId, domain, actionType, payload }) {
  const grant = await getActiveGrant(targetUserId, initiatorUserId, domain);
  if (!grant || grant.access_level !== "view_and_act") {
    const error = new Error("no_joint_grant");
    error.code = "no_joint_grant";
    throw error;
  }
  const result = await query(
    `insert into joint_actions (grant_id, initiator_user_id, target_user_id, domain, action_type, payload)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [grant.id, initiatorUserId, targetUserId, domain, actionType, JSON.stringify(payload)]
  );
  return result.rows[0];
}

// Only what THIS user (as the target) still needs to confirm or decline - never
// their own proposals, which would let the initiator effectively self-approve.
export async function listPendingJointActions(userId) {
  const result = await query(
    `select ja.*, u.display_name as initiator_display_name, u.email as initiator_email
     from joint_actions ja
     join users u on u.id = ja.initiator_user_id
     where ja.target_user_id = $1 and ja.status = 'pending' and ja.initiator_user_id != $1
     order by ja.created_at desc`,
    [userId]
  );
  return result.rows;
}

export async function getJointAction(id) {
  const result = await query(`select * from joint_actions where id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function declineJointAction(id, userId) {
  const result = await query(
    `update joint_actions set status = 'declined' where id = $1 and target_user_id = $2 and status = 'pending' returning *`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function markJointActionConfirmed(id, userId) {
  const result = await query(
    `update joint_actions set status = 'confirmed', confirmed_at = now()
     where id = $1 and target_user_id = $2 and status = 'pending'
     returning *`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}
