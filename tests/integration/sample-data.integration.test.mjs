// The example dataset — buildSampleAccount populates one account so every
// Explore capability zone + every Life node has real data, then
// wipeSampleAccount takes it all back out. Real Neon DB.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [sample, db] = await Promise.all([import("../../lib/sample-data/build.js"), import("../../lib/db.js")]);
  return { sample, pool: db.pool };
}
async function makeUser(pool) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`sd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@futureos.test`],
  );
  return r.rows[0].id;
}

test("buildSampleAccount fills every surface; wipeSampleAccount clears it", opts, async () => {
  const { sample, pool } = await mods();
  const uid = await makeUser(pool);
  try {
    await sample.buildSampleAccount(uid, { wipeFirst: false });

    const count = async (sql) => Number((await pool.query(sql, [uid])).rows[0].n);
    assert.ok((await count(`select count(*) n from bank_accounts where profile_key=$1`)) === 3, "3 bank accounts");
    assert.ok((await count(`select count(*) n from bank_transactions where profile_key=$1`)) > 60, "90d of transactions");
    assert.ok((await count(`select count(*) n from income_streams where profile_key=$1`)) >= 1, "an income stream");
    assert.ok((await count(`select count(*) n from recurring_obligations where profile_key=$1`)) === 7, "7 recurring bills");
    assert.ok((await count(`select count(*) n from financial_assets where profile_key=$1`)) >= 5, "twin assets");
    assert.ok((await count(`select count(*) n from liabilities where profile_key=$1`)) >= 1, "the card liability");
    assert.ok((await count(`select count(*) n from assets where profile_key=$1`)) >= 5, "asset-profile rows");
    assert.ok((await count(`select count(*) n from plans where profile_key=$1`)) === 6, "6 Studio plans");
    assert.ok((await count(`select count(*) n from goal_commitments where profile_key=$1 and status='active'`)) === 5, "5 active commitments");
    assert.ok((await count(`select count(*) n from provider_connections where profile_key=$1 and status <> 'not_connected'`)) === 3, "3 links");
    assert.ok((await count(`select count(*) n from lifecycle_roles where profile_key=$1 and role='guardian'`)) >= 1, "a Care Circle row");

    // every plan has at least one version (so the Future Field has a reality path)
    const planIds = (await pool.query(`select id from plans where profile_key=$1`, [uid])).rows.map((r) => r.id);
    for (const pid of planIds) {
      const v = await pool.query(`select count(*) n from plan_versions where plan_id=$1`, [pid]);
      assert.ok(Number(v.rows[0].n) >= 1, `plan ${pid} has a version`);
    }

    // idempotent re-run: still exactly the same shape, not doubled
    await sample.buildSampleAccount(uid, { wipeFirst: true });
    assert.equal(await count(`select count(*) n from plans where profile_key=$1`), 6);
    assert.equal(await count(`select count(*) n from bank_accounts where profile_key=$1`), 3);

    await sample.wipeSampleAccount(uid);
    assert.equal(await count(`select count(*) n from bank_accounts where profile_key=$1`), 0);
    assert.equal(await count(`select count(*) n from plans where profile_key=$1`), 0);
    assert.equal(await count(`select count(*) n from provider_connections where profile_key=$1`), 0);
  } finally {
    await sample.wipeSampleAccount(uid).catch(() => {});
    await pool.query(`delete from users where id = $1`, [uid]).catch(() => {});
  }
});
