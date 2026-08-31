// Account recovery (Usable RC, section 十二). The token mechanism + reset
// flow are real; EMAIL DELIVERY is not wired (needs a provider) - flagged
// in the delivery report. In a non-production build the request endpoint
// returns the token so the flow can be tested end to end.

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "./db.js";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");

// Always behaves the same whether or not the email exists (no user
// enumeration). Returns { token } ONLY in non-production for testing.
export async function requestPasswordReset(email) {
  const res = await query(`select id from users where email = $1`, [String(email ?? "").toLowerCase()]);
  const user = res.rows[0];
  if (!user) return { requested: true };

  // invalidate any prior unused tokens for this user
  await query(`update password_reset_tokens set used_at = now() where user_id = $1 and used_at is null`, [user.id]);

  const token = crypto.randomBytes(32).toString("base64url");
  await query(
    `insert into password_reset_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)`,
    [user.id, hash(token), new Date(Date.now() + TTL_MS)],
  );
  return process.env.NODE_ENV === "production" ? { requested: true } : { requested: true, token };
}

export async function resetPassword(token, newPassword) {
  if (!token || typeof newPassword !== "string" || newPassword.length < 8) {
    return { ok: false, error: "invalid_request" };
  }
  const res = await query(
    `select id, user_id, expires_at, used_at from password_reset_tokens where token_hash = $1`,
    [hash(token)],
  );
  const row = res.rows[0];
  if (!row || row.used_at || new Date(row.expires_at) <= new Date()) {
    return { ok: false, error: "invalid_or_expired_token" };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await query(`update users set password_hash = $2 where id = $1`, [row.user_id, passwordHash]);
  await query(`update password_reset_tokens set used_at = now() where id = $1`, [row.id]);
  // security: end every existing session so a stolen cookie is useless
  await query(`update user_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [row.user_id]);
  return { ok: true, userId: row.user_id };
}
