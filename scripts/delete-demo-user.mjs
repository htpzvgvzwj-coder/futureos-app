// One-off: hard-delete a demo/test user and every row it owns.
//
//   node --env-file=.env scripts/delete-demo-user.mjs joannetan2320@gmail.com
//
// Irreversible. Only run against a demo/test account you own.

import { query } from "../lib/db.js";
import { wipeSampleAccount } from "../lib/sample-data/build.js";

const email = process.argv[2];
if (!email) {
  console.error("usage: node --env-file=.env scripts/delete-demo-user.mjs <email>");
  process.exit(1);
}

const EXTRA = [
  "wedding_sessions", "hardship_sessions", "home_sessions", "retirement_sessions",
  "loan_sessions", "investment_sessions", "other_sessions", "travel_sessions",
  "mirror_chat_sessions", "user_preferences", "change_ledger_events",
  "money_moment_state", "care_shared_ranges", "care_transitions", "care_nudges",
  "care_invites", "guardian_contracts", "plan_versions", "plan_branches",
];

async function main() {
  const u = (await query(`select id, email, created_at from users where email = $1`, [email])).rows[0];
  if (!u) {
    console.log(`no user with email ${email} — nothing to do`);
    return;
  }
  console.log(`deleting ${u.email} (${u.id}, created ${u.created_at})`);

  await wipeSampleAccount(u.id); // the big profile_key-scoped table sweep + plan versions/branches

  for (const t of EXTRA) {
    await query(`delete from ${t} where profile_key = $1`, [u.id]).catch(() => {});
  }
  await query(`delete from session where user_id = $1`, [u.id]).catch(() => {});
  await query(`delete from user_sessions where user_id = $1`, [u.id]).catch(() => {});

  const del = await query(`delete from users where id = $1 returning email`, [u.id]);
  console.log(`✓ deleted user row: ${del.rows[0]?.email ?? "(already gone)"}`);

  const left = await query(`select count(*)::int c from users where email = $1`, [email]);
  console.log(`remaining users with that email: ${left.rows[0].c}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
