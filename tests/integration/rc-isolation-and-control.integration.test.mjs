// Usable RC - cross-user isolation, onboarding/consent, CSV import
// commit/rollback/idempotency, export + account deletion. Real Neon DB.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [accounts, ledger, rows, control, csvStore, authz, db] = await Promise.all([
    import("../../lib/bank/accounts-store.js"),
    import("../../lib/transaction-ledger/store.js"),
    import("../../lib/financial-twin/rows-store.js"),
    import("../../lib/account-control/store.js"),
    import("../../lib/csv-import/store.js"),
    import("../../lib/authorization/store.js"),
    import("../../lib/db.js"),
  ]);
  return { accounts, ledger, rows, control, csvStore, authz, pool: db.pool };
}

async function makeUser(pool, tag) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`itest-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@futureos.test`],
  );
  return r.rows[0].id;
}
async function cleanupUser(pool, uid) {
  for (const t of ["authorization_requests", "authorization_policies", "bank_transactions", "bank_accounts", "financial_assets", "liabilities", "income_streams", "recurring_obligations", "ripple_events", "change_ledger_events", "consent_records", "care_handoff_plans", "lifecycle_roles", "import_batches", "audit_events", "user_onboarding", "account_deletions", "user_sessions"]) {
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

test("Phase 6 Care Circle: relation/covers/note round-trip; handoff plan is 'described' only", opts, async (t) => {
  const { control, pool } = await mods();
  const u = await makeUser(pool, "care6");
  t.after(() => cleanupUser(pool, u));

  // grant with the new fields, then edit them
  const g = await control.grantRole(u, {
    subjectKey: "guardian-x",
    role: "guardian",
    scope: "approve",
    relationLabel: "My mother",
    covers: ["bills", "emergency", "bills"], // deduped
    note: "joint account only",
  });
  assert.equal(g.relationLabel, "My mother");
  assert.deepEqual([...g.covers].sort(), ["bills", "emergency"]);
  assert.equal(g.note, "joint account only");

  const edited = await control.updateRole(u, g.id, { relationLabel: "Mum", covers: ["everything"] });
  assert.equal(edited.relationLabel, "Mum");
  assert.deepEqual(edited.covers, ["everything"]);
  assert.equal(edited.note, "joint account only", "unspecified fields are left untouched");

  // a partial update with nothing to change returns null
  assert.equal(await control.updateRole(u, g.id, {}), null);
  // updating someone else's / a missing role returns null (no throw)
  assert.equal(await control.updateRole("someone-else", g.id, { note: "x" }), null);

  // handoff plan: upsert, always "described", never executed
  const h1 = await control.setHandoffPlan(u, {
    kind: "retirement",
    successorRoleId: g.id,
    successorLabel: "Mum",
    triggerNote: "at 65",
    instructions: "keep the bills paid",
  });
  assert.equal(h1.status, "described");
  assert.equal(h1.kind, "retirement");
  assert.equal(h1.successorRoleId, g.id);

  const h2 = await control.setHandoffPlan(u, { kind: "incapacity", triggerNote: "if hospitalised" });
  assert.equal(h2.kind, "incapacity", "second call updates the same row");
  assert.equal(h2.status, "described");
  assert.equal((await control.getHandoffPlan(u)).triggerNote, "if hospitalised");

  await assert.rejects(() => control.setHandoffPlan(u, { kind: "executed" }), /invalid handoff kind/);

  // export includes the new table; delete cascade removes it
  const exp = await control.exportUserData(u);
  assert.ok("care_handoff_plans" in exp.tables, "handoff plan is in the data export");
});

test("Phase 6 approval queue: an amount rule parks a transfer; approve executes it, decline does not", opts, async (t) => {
  const { accounts, ledger, authz, control, pool } = await mods();
  const u = await makeUser(pool, "authz6");
  const other = await makeUser(pool, "authz6b");
  t.after(async () => { await cleanupUser(pool, u); await cleanupUser(pool, other); });

  const cur = await accounts.createBankAccount(u, { kind: "current", displayName: "Everyday" });
  const sav = await accounts.createBankAccount(u, { kind: "savings", displayName: "Savings" });
  await ledger.appendTransaction(u, { accountId: cur.id, direction: "credit", amount: 5000, channel: "salary" });

  // owner sets "check any move over 100"
  const policy = await authz.setAuthPolicy(u, { approvalOverAmount: 100 });
  assert.equal(policy.approvalOverAmount, 100);

  // a 500 move is above the rule -> required
  const verdict = authz.evaluateAuthorization({ accountType: "individual", policy, kind: "internal_transfer", amount: 500 });
  assert.equal(verdict.required, true);

  const idk = "itest-authz-" + Date.now();
  const req = await authz.createAuthRequest(u, {
    kind: "internal_transfer",
    summary: "Move SGD 500 between your own accounts",
    amount: 500,
    payload: { fromAccountId: cur.id, toAccountId: sav.id, amount: 500, currency: "SGD", idempotencyKey: idk },
    reason: verdict.reason,
  });
  assert.equal((await authz.listAuthRequests(u, { status: "pending" })).length, 1);
  assert.equal(await authz.countPendingAuthRequests(u), 1);

  // no money has moved yet
  assert.equal((await ledger.listTransactions(u)).filter((x) => x.isInternalTransfer).length, 0);

  // cross-user cannot decide it
  assert.equal(await authz.decideAuthRequest(other, req.id, { decision: "approved" }), null);

  // approve -> executes the transfer from the payload, status 'executed'
  const decided = await authz.decideAuthRequest(u, req.id, { decision: "approved", decidedBy: "owner" });
  assert.equal(decided.status, "executed");
  const legs = (await ledger.listTransactions(u)).filter((x) => x.isInternalTransfer);
  assert.equal(legs.length, 2, "a real double-entry transfer ran");
  const bal = await ledger.getAccountBalances(u);
  assert.equal(bal.find((b) => b.accountId === sav.id).postedBalance, 500);

  // deciding again is a no-op
  const again = await authz.decideAuthRequest(u, req.id, { decision: "declined" });
  assert.equal(again.unchanged, true);

  // a declined request never moves money
  const req2 = await authz.createAuthRequest(u, {
    kind: "internal_transfer",
    summary: "Move SGD 900",
    amount: 900,
    payload: { fromAccountId: cur.id, toAccountId: sav.id, amount: 900, currency: "SGD", idempotencyKey: idk + "-2" },
    reason: "over the rule",
  });
  const declined = await authz.decideAuthRequest(u, req2.id, { decision: "declined" });
  assert.equal(declined.status, "declined");
  assert.equal((await ledger.listTransactions(u)).filter((x) => x.isInternalTransfer).length, 2, "still just the first transfer");

  const exp = await control.exportUserData(u);
  assert.ok("authorization_requests" in exp.tables && "authorization_policies" in exp.tables, "both new tables are in the export");
});
