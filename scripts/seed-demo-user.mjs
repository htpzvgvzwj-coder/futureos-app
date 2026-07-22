// One-off migration: re-points every existing "karina-demo" profile_key row
// (all of this session's already-seeded wedding/home/retirement/hardship/mirror
// data) to a real user account, now that FutureOS has real auth. Idempotent -
// re-running finds nothing left at 'karina-demo' and is a no-op. Run via
// `npm run db:seed-demo`.
import { createUser } from "../lib/auth.js";
import { query } from "../lib/db.js";

const DEMO_EMAIL = "karina@demo.futureos";
const DEMO_TABLES = [
  "wedding_sessions",
  "other_sessions",
  "home_sessions",
  "retirement_sessions",
  "hardship_sessions",
  "mirror_debates",
  "loan_sessions",
  "investment_sessions",
  "relationship_milestones",
  "decision_checks",
  "micro_insurance_offers",
  "credentials",
];

const existing = await query(`select id, email, display_name from users where email = $1`, [DEMO_EMAIL]);
const user =
  existing.rows[0] ??
  (await createUser({
    email: DEMO_EMAIL,
    password: process.env.DEMO_USER_PASSWORD ?? "demo-password-change-me",
    displayName: "Karina",
  }));

console.log(`Demo user: ${user.email} (${user.id})`);

for (const table of DEMO_TABLES) {
  const result = await query(`update ${table} set profile_key = $1 where profile_key = 'karina-demo'`, [user.id]);
  if (result.rowCount > 0) console.log(`  ${table}: re-keyed ${result.rowCount} row(s)`);
}

console.log("Done.");
process.exit(0);
