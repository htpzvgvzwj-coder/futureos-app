// Account recovery flow - real Neon DB. Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [auth, recovery, db] = await Promise.all([
    import("../../lib/auth.js"),
    import("../../lib/account-recovery.js"),
    import("../../lib/db.js"),
  ]);
  return { auth, recovery, pool: db.pool };
}

test("password reset: token issued -> new password works, old sessions revoked, token single-use", opts, async (t) => {
  const { auth, recovery, pool } = await mods();
  const email = `itest-recover-${Date.now()}@futureos.test`;
  const user = await auth.createUser({ email, password: "old-password-1", displayName: "R" });
  const { token: sessionToken } = await auth.createSession(user.id);
  t.after(async () => {
    await pool.query("delete from password_reset_tokens where user_id = $1", [user.id]);
    await pool.query("delete from user_sessions where user_id = $1", [user.id]);
    await pool.query("delete from users where id = $1", [user.id]);
  });

  // the existing session is valid now
  assert.equal(await auth.getCurrentUserId({ cookies: { get: () => ({ value: sessionToken }) } }), user.id);

  const reqRes = await recovery.requestPasswordReset(email);
  assert.equal(reqRes.requested, true);
  assert.ok(reqRes.token, "non-prod returns the token for testing");

  // a bogus token is rejected
  assert.equal((await recovery.resetPassword("not-a-real-token", "new-password-1")).ok, false);

  const done = await recovery.resetPassword(reqRes.token, "new-password-1");
  assert.equal(done.ok, true);

  // old password no longer verifies; new one does
  assert.equal(await auth.verifyPassword(email, "old-password-1"), null);
  assert.ok(await auth.verifyPassword(email, "new-password-1"));

  // every prior session was revoked
  assert.equal(await auth.getCurrentUserId({ cookies: { get: () => ({ value: sessionToken }) } }), null);

  // the reset token cannot be reused
  assert.equal((await recovery.resetPassword(reqRes.token, "another-password-1")).ok, false);
});

test("requestPasswordReset never reveals whether an email exists", opts, async () => {
  const { recovery } = await mods();
  const res = await recovery.requestPasswordReset(`does-not-exist-${Date.now()}@futureos.test`);
  assert.equal(res.requested, true);
  assert.equal(res.token, undefined, "no token for an unknown email");
});
