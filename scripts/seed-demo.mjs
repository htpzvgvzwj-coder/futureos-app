// Seed ONE named demo login (demo@futureos.app) with the full example
// dataset, so every tab and every feature has real data the moment you log
// in. The dataset itself lives in lib/sample-data/build.js and is shared
// with POST /api/account/sample-data (the in-app "Load example data"
// action); this script only owns the demo user + password.
//
//   npm run seed:demo
//
// Idempotent: re-running wipes this one account's data and rebuilds it.

import bcrypt from "bcryptjs";
import { createUser } from "../lib/auth.js";
import { query } from "../lib/db.js";
import { buildSampleAccount } from "../lib/sample-data/build.js";

const EMAIL = process.env.DEMO_EMAIL ?? "demo@futureos.app";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";
const BASE = process.env.DEMO_BASE_URL ?? "https://futureos-app.vercel.app";

async function main() {
  let u = (await query(`select id from users where email = $1`, [EMAIL])).rows[0];
  if (u) {
    console.log(`• existing demo user ${EMAIL} — rebuilding its data`);
    await query(`update users set password_hash = $2, display_name = 'Demo' where id = $1`, [u.id, await bcrypt.hash(PASSWORD, 12)]);
  } else {
    u = await createUser({ email: EMAIL, password: PASSWORD, displayName: "Demo" });
    console.log(`• created demo user ${EMAIL}`);
  }

  await buildSampleAccount(u.id, { wipeFirst: true });

  console.log("\n✓ demo account ready\n");
  console.log(`   URL:      ${BASE}`);
  console.log(`   email:    ${EMAIL}`);
  console.log(`   password: ${PASSWORD}\n`);
  console.log("   Every Explore capability zone, every Life node, Connections and");
  console.log("   Family & Care now have real data to work with.\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
