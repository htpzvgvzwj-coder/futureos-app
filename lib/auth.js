// Real multi-user auth (PDR-013 follow-up). Hand-rolled to match this app's
// existing no-ORM, no-framework convention (every other store is a plain
// query(text, params) call over lib/db.js's pg wrapper) - NextAuth would be
// the first framework-shaped abstraction in a codebase that otherwise has
// none. Password hashing uses bcryptjs (pure JS, no native build step) rather
// than bcrypt, to avoid node-gyp friction in this dev environment.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query } from "./db.js";
import { getActiveGrant } from "./access-grant-store.js";

export const SESSION_COOKIE_NAME = "futureos_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createUser({ email, password, displayName }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `insert into users (email, password_hash, display_name) values ($1, $2, $3)
     returning id, email, display_name, created_at`,
    [email.toLowerCase(), passwordHash, displayName]
  );
  return result.rows[0];
}

export async function verifyPassword(email, password) {
  const result = await query(`select * from users where email = $1`, [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? user : null;
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(`insert into user_sessions (user_id, token_hash, expires_at) values ($1, $2, $3)`, [
    userId,
    hashToken(token),
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function revokeSession(token) {
  await query(`update user_sessions set revoked_at = now() where token_hash = $1`, [hashToken(token)]);
}

// The one function all API routes import instead of the old hardcoded
// DEFAULT_PROFILE_KEY - reads the session cookie straight off the NextRequest
// passed into App Router route handlers.
export async function getCurrentUserId(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await query(
    `select user_id from user_sessions
     where token_hash = $1 and revoked_at is null and expires_at > now()`,
    [hashToken(token)]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function getUserById(userId) {
  const result = await query(`select id, email, display_name, created_at from users where id = $1`, [userId]);
  return result.rows[0] ?? null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Used only by the read-only "view as" routes (Phase B) - every write/execute
// route resolves its own userId directly via getCurrentUserId and ignores
// ?asUser= entirely, on purpose (joint write-permission is unbuilt).
export async function resolveEffectiveProfileKey(request, domain) {
  const userId = await getCurrentUserId(request);
  if (!userId) return { error: "unauthorized", status: 401 };

  const asUser = new URL(request.url).searchParams.get("asUser");
  if (!asUser) return { profileKey: userId };
  // A malformed asUser (garbage, not a real uuid) must fail cleanly, not
  // crash the query layer with a Postgres type error.
  if (!UUID_PATTERN.test(asUser)) return { error: "invalid_as_user", status: 400 };

  const grant = await getActiveGrant(asUser, userId, domain);
  if (!grant) return { error: "no_grant", status: 403 };
  return { profileKey: asUser };
}
