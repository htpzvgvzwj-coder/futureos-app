// Usable RC - cross-user isolation, onboarding/consent, CSV import
// commit/rollback/idempotency, export + account deletion. Real Neon DB.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [accounts, ledger, rows, control, csvStore, db] = await Promise.all([
    import("../../lib/bank/accounts-store.js"),
    import("../../lib/transaction-ledger/store.js"),
    import("../../lib/financial-twin/rows-store.js"),
    import("../../lib/account-control/store.js"),
    import("../../lib/csv-import/store.js"),
    import("../../lib/db.js"),
  ]);
  return { accounts, ledger, rows, control, csvStore, pool: db.pool };
}

async function makeUser(pool, tag) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`itest-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@futureos.test`],
  );
  return r.rows[0].id;
}
async function cleanupUser(pool, uid) {
  for (const t of ["bank_transactions", "bank_accounts", "financial_assets", "liabilities", "income_streams", "recurring_obligations", "ripple_events", "consent_records", "lifecycle_roles", "import_batches", "audit_events", "user_onboarding", "account_deletions", "user_sessions"]) {
    await pool.query(`delete from ${t} where profile_key = $1 or ${t === "user_sessions" ? "user_id" : "profile_key"} = $1`, [uid]).catch(() => {});
  }
  await pool.query(`delete from users where id = $1`, [uid]).catch(() => {});
}

test("cross-user isolation: A cannot see B's accounts, transactions or twin rows", opts, async (t) => {
  const { accounts, ledger, rows, pool } = await mods();
  const a = await makeUser(pool, "isoA");
  const b = await makeUser(pool, "isoB");
  t.after(async () => { await cleanupUser(pool, a); await cleanupUser(pool, b); });

  const accA = await accounts.createBankAccount(a, { kind: "current", displayName: "A current" });
  const accB = await accounts.createBankAccount(b, { kind: "current", displayName: "B current" });
  await ledger.appendTransaction(a, { accountId: accA.id, direction: "credit", amount: 1000, channel: "salary" });
  await ledger.appendTransaction(b, { accountId: accB.id, direction: "credit", amount: 5000, channel: "salary" });
  await rows.createFinancialAsset(a, { assetClass: "bank_account", currentValue: 111 });
  await rows.createFinancialAsset(b, { assetClass: "bank_account", currentValue: 999 });

  const aAccounts = await accounts.listBankAccounts(a);
  assert.equal(aAccounts.length, 1);
  assert.equal(aAccounts[0].displayName, "A current");
  assert.equal((await accounts.getBankAccount(a, accB.id)), null, "A cannot fetch B's account by id");

  const aTx = await ledger.listTransactions(a);
  assert.ok(aTx.every((x) => x.accountId === accA.id));
  assert.equal((await ledger.getAccountBalances(a)).length, 1);
  assert.equal((await ledger.getAccountBalances(b))[0].postedBalance, 5000);

  assert.equal((await rows.listFinancialAssets(a)).length, 1);
  assert.equal((await rows.listFinancialAssets(a))[0].currentValue, 111);

  // A trying to reverse B's transaction fails (not found for A)
  const bTx = await ledger.listTransactions(b);
  await assert.rejects(() => ledger.reverseTransaction(a, bTx[0].id), /not found/);
});

test("onboarding + consent: a fresh user starts with no persona and no consent; required scope is marked", opts, async (t) => {
  const { control, pool } = await mods();
  const u = await makeUser(pool, "onb");
  t.after(() => cleanupUser(pool, u));

  const start = await control.getOnboarding(u);
  assert.equal(start.status, "not_started");
  assert.equal(start.accountType, null);

  await control.setAccountType(u, "individual");
  const consent0 = await control.getConsent(u);
  assert.equal(consent0.every((c) => c.granted === false), true, "nothing granted by default");
  assert.equal(consent0.find((c) => c.scope === "account_data").required, true);

  await control.setConsent(u, "account_data", true);
  await control.setConsent(u, "transaction_data", true);
  const consent1 = await control.getConsent(u);
  assert.equal(consent1.find((c) => c.scope === "account_data").granted, true);
  assert.equal(consent1.find((c) => c.scope === "guardian_monitoring").granted, false);

  await control.advanceOnboarding(u, "complete");
  assert.equal((await control.getOnboarding(u)).status, "complete");

  const audit = await control.listAuditEvents(u);
  assert.ok(audit.some((e) => e.kind === "consent_granted"));
});

test("CSV import: preview then atomic commit; the same file is idempotent; rollback removes exactly that batch", opts, async (t) => {
  const { accounts, ledger, csvStore, pool } = await mods();
  const u = await makeUser(pool, "csv");
  t.after(() => cleanupUser(pool, u));
  const acc = await accounts.createBankAccount(u, { kind: "current" });

  const { normaliseRows, guessMapping, parseCsv, splitDuplicates } = await import("../../lib/csv-import/parse.js");
  const csv = ["Date,Description,Debit,Credit,Currency", "01/09/2026,SALARY,,4000,SGD", "02/09/2026,GROCERIES,55.20,,SGD", "03/09/2026,GYM,60,,SGD"].join("\n");
  const grid = parseCsv(csv);
  const mapping = guessMapping(grid[0]);
  const { transactions } = normaliseRows(grid, mapping);
  const existing = await csvStore.existingFingerprints(u, acc.id);
  const { fresh, duplicates } = splitDuplicates(transactions, existing);
  assert.equal(fresh.length, 3);
  assert.equal(duplicates.length, 0);

  const hash = csvStore.fileHash(csv);
  const commit1 = await csvStore.commitBatch(u, { hash, accountId: acc.id, fileName: "sep.csv", mapping, transactions: fresh, skipped: 0 });
  assert.equal(commit1.idempotent, false);
  assert.equal(commit1.imported, 3);

  const bal1 = (await ledger.getAccountBalances(u))[0];
  assert.equal(bal1.postedBalance, 4000 - 55.2 - 60);
  assert.equal((await ledger.reconcileLedger(u)).ok, true);

  // same file again -> no double import
  const commit2 = await csvStore.commitBatch(u, { hash, accountId: acc.id, fileName: "sep.csv", mapping, transactions: fresh, skipped: 0 });
  assert.equal(commit2.idempotent, true);
  assert.equal((await ledger.listTransactions(u)).length, 3, "still 3, not 6");

  // rollback removes exactly the batch's rows
  const rb = await csvStore.rollbackBatch(u, commit1.batchId);
  assert.equal(rb.removed, 3);
  assert.equal((await ledger.listTransactions(u)).length, 0);
  const batches = await csvStore.listBatches(u);
  assert.equal(batches.find((x) => x.id === commit1.batchId).status, "rolled_back");
});

test("export returns every owned table; delete cascades, scrubs the login and revokes sessions", opts, async (t) => {
  const { accounts, ledger, rows, control, pool } = await mods();
  const u = await makeUser(pool, "del");
  t.after(() => cleanupUser(pool, u));

  const acc = await accounts.createBankAccount(u, { kind: "current" });
  await ledger.appendTransaction(u, { accountId: acc.id, direction: "credit", amount: 100 });
  await rows.createLiability(u, { liabilityClass: "personal_loan", currentBalance: 5000 });
  await pool.query(`insert into user_sessions (user_id, token_hash, expires_at) values ($1,$2, now() + interval '1 day')`, [u, `tok-${u}`]);

  const exp = await control.exportUserData(u);
  assert.ok(exp.tables.bank_accounts.length === 1);
  assert.ok(exp.tables.liabilities.length === 1);

  const del = await control.requestAccountDeletion(u, { reason: "test" });
  assert.ok(del.rowsRemoved >= 2);
  assert.equal((await accounts.listBankAccounts(u)).length, 0, "accounts gone");
  assert.equal((await rows.listLiabilities(u)).length, 0, "liabilities gone");

  const sess = await pool.query(`select revoked_at from user_sessions where user_id = $1`, [u]);
  assert.ok(sess.rows.every((r) => r.revoked_at != null), "all sessions revoked");
  const user = await pool.query(`select email, password_hash from users where id = $1`, [u]);
  assert.match(user.rows[0].email, /deleted\+/);
  assert.equal(user.rows[0].password_hash, "");
  const audit = await control.listAuditEvents(u);
  assert.ok(audit.some((e) => e.kind === "account_delete_requested"), "deletion is audited");
});

test("lifecycle roles: a beneficiary placeholder is flagged as needing legal confirmation; revoke works", opts, async (t) => {
  const { control, pool } = await mods();
  const u = await makeUser(pool, "role");
  t.after(() => cleanupUser(pool, u));

  const b = await control.grantRole(u, { role: "beneficiary_placeholder", scope: "view" });
  assert.equal(b.legalConfirmationRequired, true);
  assert.equal(b.status, "pending", "no subject yet -> pending");

  const g = await control.grantRole(u, { subjectKey: "some-guardian-id", role: "guardian", scope: "approve" });
  assert.equal(g.status, "active");

  const roles = await control.listRoles(u);
  assert.equal(roles.length, 2);
  assert.equal(await control.revokeRole(u, g.id), true);
  assert.equal((await control.listRoles(u)).length, 1);
});
