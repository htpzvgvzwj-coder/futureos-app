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
import { buildSampleAccount, buildChildAccount, buildElderAccount } from "../lib/sample-data/build.js";

const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";
const BASE = process.env.DEMO_BASE_URL ?? "https://futureos-app.vercel.app";

async function ensureUser(email, displayName) {
  let u = (await query(`select id from users where email = $1`, [email])).rows[0];
  if (u) {
    await query(`update users set password_hash = $2, display_name = $3 where id = $1`, [u.id, await bcrypt.hash(PASSWORD, 12), displayName]);
    console.log(`• ${email} — rebuilding its data`);
  } else {
    u = await createUser({ email, password: PASSWORD, displayName });
    console.log(`• created ${email}`);
  }
  return u;
}

async function main() {
  const adult = await ensureUser(process.env.DEMO_EMAIL ?? "demo@futureos.app", "Demo");
  await buildSampleAccount(adult.id, { wipeFirst: true });

  const kid = await ensureUser("demo-kid@futureos.app", "Demo (youth)");
  await buildChildAccount(kid.id, { wipeFirst: true });

  const elder = await ensureUser("demo-elder@futureos.app", "Demo (later life)");
  await buildElderAccount(elder.id, { wipeFirst: true });

  console.log("\n✓ demo accounts ready\n");
  console.log(`   URL:   ${BASE}   password: ${PASSWORD}`);
  console.log(`   demo@futureos.app        — funded adult (Today / Life / Guardian / History)`);
  console.log(`   demo-kid@futureos.app    — youth: Growing Account Today + Ask to Pay`);
  console.log(`   demo-elder@futureos.app  — later life: Calm Today + Payment Pause\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
