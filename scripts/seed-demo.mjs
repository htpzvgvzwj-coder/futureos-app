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
import { grantRole } from "../lib/account-control/store.js";
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

  // The child and the elder are in the ADULT's family: the adult is a
  // linked approver on the child's account and a linked trusted contact
  // on the elder's, so demo@ sees both under Guardian → "People you look
  // after" and in Family & Care. They also each have their own login so
  // the age-adapted Today (Growing Account / Calm Today) can be shown.
  const kid = await ensureUser("demo-kid@futureos.app", "Aaron");
  await buildChildAccount(kid.id, { wipeFirst: true, guardianKey: adult.id });

  const elder = await ensureUser("demo-elder@futureos.app", "Mother");
  await buildElderAccount(elder.id, { wipeFirst: true, trustedKey: adult.id });

  // the reciprocal side on the adult's own circle
  await grantRole(adult.id, { subjectKey: kid.id, role: "dependent", scope: "manage", relationLabel: "Aaron — my son (14)", note: "youth account I manage" }).catch(() => {});
  await grantRole(adult.id, { subjectKey: elder.id, role: "dependent", scope: "suggest", relationLabel: "My mother", note: "I help with her banking" }).catch(() => {});

  console.log("\n✓ demo accounts ready\n");
  console.log(`   URL:   ${BASE}   password: ${PASSWORD}`);
  console.log(`   demo@futureos.app        — the adult: their own money + Aaron & Mother under "People you look after"`);
  console.log(`   demo-kid@futureos.app    — Aaron (14): Growing Account Today + Ask to Pay`);
  console.log(`   demo-elder@futureos.app  — Mother: Calm Today + Payment Pause\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
