// Usable RC - cross-user isolation, onboarding/consent, CSV import
// commit/rollback/idempotency, export + account deletion. Real Neon DB.
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [accounts, ledger, rows, control, csvStore, authz, care, snap, db] = await Promise.all([
    import("../../lib/bank/accounts-store.js"),
    import("../../lib/transaction-ledger/store.js"),
    import("../../lib/financial-twin/rows-store.js"),
    import("../../lib/account-control/store.js"),
    import("../../lib/csv-import/store.js"),
    import("../../lib/authorization/store.js"),
    import("../../lib/care/link-store.js"),
    import("../../lib/care/guardian-snapshot.js"),
    import("../../lib/db.js"),
  ]);
  return { accounts, ledger, rows, control, csvStore, authz, care, snap, pool: db.pool };
}

async function makeUser(pool, tag) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`itest-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@futureos.test`],
  );
  return r.rows[0].id;
}
async function cleanupUser(pool, uid) {
  await pool.query(`delete from care_invites where profile_key = $1 or accepted_by = $1`, [uid]).catch(() => {});
  await pool.query(`delete from care_nudges where profile_key = $1 or subject_key = $1`, [uid]).catch(() => {});
  await pool.query(`delete from lifecycle_roles where profile_key = $1 or subject_key = $1`, [uid]).catch(() => {});
  for (const t of ["care_shared_ranges", "care_transitions", "authorization_requests", "authorization_policies", "bank_transactions", "bank_accounts", "financial_assets", "liabilities", "income_streams", "recurring_obligations", "ripple_events", "change_ledger_events", "consent_records", "care_handoff_plans", "lifecycle_roles", "import_batches", "audit_events", "user_onboarding", "account_deletions", "user_sessions"]) {
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
  const declined = await authz.decideAuthRequest(u, req2.id, { decision: "declined", note: "not this month" });
  assert.equal(declined.status, "declined");
  assert.equal((await ledger.listTransactions(u)).filter((x) => x.isInternalTransfer).length, 2, "still just the first transfer");

  const exp = await control.exportUserData(u);
  assert.ok("authorization_requests" in exp.tables && "authorization_policies" in exp.tables, "both new tables are in the export");
});

test("Phase 6 Round 3 cross-user link: invite -> accept -> scoped view -> guardian approves -> revoke", opts, async (t) => {
  const { accounts, ledger, authz, care, snap, control, pool } = await mods();
  const owner = await makeUser(pool, "linkOwner");
  const guardian = await makeUser(pool, "linkGuardian");
  const stranger = await makeUser(pool, "linkStranger");
  t.after(async () => { await cleanupUser(pool, owner); await cleanupUser(pool, guardian); await cleanupUser(pool, stranger); });

  // owner adds a pending guardian placeholder with approve scope, then invites
  const role = await control.grantRole(owner, { role: "guardian", scope: "approve" });
  assert.equal(role.status, "pending");
  const { code } = await care.createCareInvite(owner, { roleId: role.id });
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  // you cannot accept your own invite
  await assert.rejects(() => care.acceptCareInvite(owner, code), /your own invite/i);

  // the guardian accepts
  const linked = await care.acceptCareInvite(guardian, code);
  assert.equal(linked.ownerKey, owner);
  assert.equal(linked.scope, "approve");

  // the same code cannot be used again
  await assert.rejects(() => care.acceptCareInvite(stranger, code), /accepted|not valid/i);

  // the gate: guardian passes, a stranger does not
  assert.ok(await care.assertActiveRole(guardian, owner, "view"));
  assert.ok(await care.assertActiveRole(guardian, owner, "approve"));
  assert.equal(await care.assertActiveRole(stranger, owner, "view"), null);
  assert.equal(await care.assertActiveRole(guardian, stranger, "view"), null, "the link is directional and specific");

  // listings
  const sup = await care.listSupervisedByMe(guardian);
  assert.equal(sup.length, 1);
  assert.equal(sup[0].ownerKey, owner);
  assert.equal((await care.listMySupervisors(owner)).length, 1);

  // a 'view' snapshot never carries amounts; an 'approve' one does
  const viewSnap = await snap.buildGuardianSnapshot(owner, "view");
  assert.equal(viewSnap.showsAmounts, false);
  assert.ok(!("pendingApprovals" in viewSnap), "view scope gets no queue detail");
  assert.ok(["steady", "tight", "attention"].includes(viewSnap.health));

  // owner parks a transfer; guardian approves it through the care path
  const cur = await accounts.createBankAccount(owner, { kind: "current", displayName: "Everyday" });
  const sav = await accounts.createBankAccount(owner, { kind: "savings", displayName: "Savings" });
  await ledger.appendTransaction(owner, { accountId: cur.id, direction: "credit", amount: 3000, channel: "salary" });
  await authz.setAuthPolicy(owner, { approvalOverAmount: 50 });
  const req = await authz.createAuthRequest(owner, {
    kind: "internal_transfer",
    summary: "Move SGD 300",
    amount: 300,
    payload: { fromAccountId: cur.id, toAccountId: sav.id, amount: 300, currency: "SGD", idempotencyKey: "itest-link-" + Date.now() },
    reason: "over the rule",
  });

  const approveSnap = await snap.buildGuardianSnapshot(owner, "approve");
  assert.equal(approveSnap.pendingApprovalCount, 1);
  assert.equal(approveSnap.pendingApprovals[0].id, req.id);

  const gate = await care.assertActiveRole(guardian, owner, "approve");
  const decided = await authz.decideAuthRequest(owner, req.id, { decision: "approved", decidedBy: "guardian", roleId: gate.roleId });
  assert.equal(decided.status, "executed");
  assert.equal((await ledger.listTransactions(owner)).filter((x) => x.isInternalTransfer).length, 2, "the guardian's approval ran the transfer");

  // the approval is on the owner's History, attributed to the guardian
  const led = await pool.query(
    `select actor, source_feature from change_ledger_events where profile_key = $1 and action_type = 'guardian_action'`,
    [owner],
  );
  assert.equal(led.rows.length, 1, "a guardian_action History event was written");
  assert.equal(led.rows[0].actor, "guardian");

  // either party can sever the link; afterwards the gate is closed
  assert.equal(await care.revokeCareLink(owner, { roleId: role.id }), true);
  assert.equal(await care.assertActiveRole(guardian, owner, "view"), null);
  assert.equal((await care.listSupervisedByMe(guardian)).length, 0);
});

test("Phase 6 Round 5 Guardian mechanics: cooling-off, weekly allowance, two-person, decline needs a reason", opts, async (t) => {
  const { accounts, ledger, authz, care, control, pool } = await mods();
  const owner = await makeUser(pool, "mechOwner");
  const guardian = await makeUser(pool, "mechGuard");
  t.after(async () => { await cleanupUser(pool, owner); await cleanupUser(pool, guardian); });

  const cur = await accounts.createBankAccount(owner, { kind: "current", displayName: "Everyday" });
  const sav = await accounts.createBankAccount(owner, { kind: "savings", displayName: "Savings" });
  await ledger.appendTransaction(owner, { accountId: cur.id, direction: "credit", amount: 9000, channel: "salary" });
  const link = await control.grantRole(owner, { subjectKey: guardian, role: "guardian", scope: "approve" });
  // one internal transfer writes two ledger legs; count transfers, not legs
  const nTransfers = async () => (await ledger.listTransactions(owner)).filter((x) => x.isInternalTransfer).length / 2;

  const mk = (amount, key) =>
    authz.createAuthRequest(owner, {
      kind: "internal_transfer",
      summary: `Move SGD ${amount}`,
      amount,
      payload: { fromAccountId: cur.id, toAccountId: sav.id, amount, currency: "SGD", idempotencyKey: key },
      reason: "test",
    });

  // --- weekly allowance: a small move clears itself, a bigger one does not
  await authz.setAuthPolicy(owner, { approvalOverAmount: 20, mode: "approval" });
  await authz.setLinkAllowance(owner, link.id, 100);
  const small = await mk(60, "mech-small-" + Date.now());
  assert.equal(small.status, "executed", "60 <= 100/week allowance -> auto-approved");
  assert.equal(small.autoReason, "within_allowance");
  assert.equal(await nTransfers(), 1);
  const big = await mk(80, "mech-big-" + Date.now()); // 60 + 80 > 100
  assert.equal(big.status, "pending", "over the remaining allowance -> still waits");
  await authz.cancelAuthRequest(owner, big.id);
  await authz.setLinkAllowance(owner, link.id, null);

  // --- cooling-off: a parked move runs itself once the deadline passes
  await authz.setAuthPolicy(owner, { mode: "cooling_off", coolingOffHours: 48, requireBoth: false });
  const cool = await mk(300, "mech-cool-" + Date.now());
  assert.equal(cool.status, "pending");
  assert.ok(cool.autoExecuteAt, "a cooling-off deadline is set");
  await pool.query(`update authorization_requests set auto_execute_at = now() - interval '1 minute' where id = $1`, [cool.id]);
  const swept = await authz.sweepDueRequests(owner);
  assert.equal(swept, 1);
  assert.equal((await authz.listAuthRequests(owner, { status: "executed" })).some((r) => r.id === cool.id), true);
  assert.equal(await nTransfers(), 2);

  // --- two-person: a guardian approve alone does NOT run it; owner confirm completes it
  await authz.setAuthPolicy(owner, { mode: "approval", requireBoth: true });
  const both = await mk(500, "mech-both-" + Date.now());
  const gate = await care.assertActiveRole(guardian, owner, "approve");
  const half = await authz.decideAuthRequest(owner, both.id, { decision: "approved", decidedBy: "guardian", roleId: gate.roleId });
  assert.equal(half.blockedPendingOwner, true);
  assert.equal(await nTransfers(), 2, "not run on the guardian's approval alone");
  const done = await authz.confirmOwnerHalf(owner, both.id);
  assert.equal(done.status, "executed");
  assert.equal(await nTransfers(), 3, "runs once the owner also confirms");

  // --- a decline must carry a reason
  await authz.setAuthPolicy(owner, { requireBoth: false });
  const dec = await mk(700, "mech-dec-" + Date.now());
  await assert.rejects(() => authz.decideAuthRequest(owner, dec.id, { decision: "declined" }), /reason/i);
  const declined = await authz.decideAuthRequest(owner, dec.id, { decision: "declined", note: "not now" });
  assert.equal(declined.status, "declined");
  assert.equal(declined.decisionNote, "not now");
});

test("Phase 6 Round 5 Care extras: nudges, shared ranges, and age-transition proposals", opts, async (t) => {
  const [{ createNudge, listNudges, resolveNudge, setSharedRange, listSharedRanges }, transitions, { control, pool }] = await Promise.all([
    import("../../lib/care/extras.js"),
    import("../../lib/care/transitions.js"),
    mods(),
  ]);
  const owner = await makeUser(pool, "extrasOwner");
  const helper = await makeUser(pool, "extrasHelper");
  t.after(async () => { await cleanupUser(pool, owner); await cleanupUser(pool, helper); });

  // nudge: owner -> a linked person; they see it, then resolve it
  const link = await control.grantRole(owner, { subjectKey: helper, role: "trusted_contact", scope: "view" });
  const n = await createNudge(owner, { roleId: link.id, subjectKey: helper, title: "Please check in" });
  const seen = await listNudges(helper, owner);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].id, n.id);
  assert.equal(await resolveNudge(helper, n.id), true);
  assert.equal((await listNudges(helper, owner)).length, 0);
  // someone else cannot resolve it
  assert.equal(await resolveNudge(owner, n.id), false);

  // shared ranges: upsert per category, never exact amounts elsewhere
  await setSharedRange(owner, { category: "rent", low: 1500, high: 2000, note: "joint flat" });
  await setSharedRange(owner, { category: "rent", low: 1600, high: 2100 });
  const ranges = await listSharedRanges(owner);
  assert.equal(ranges.length, 1, "same category updates, not duplicates");
  assert.deepEqual([ranges[0].low, ranges[0].high], [1600, 2100]);

  // age transitions: a youth account with a birth year >= 18 gets both proposals
  await control.setAccountType(owner, "youth");
  await transitions.setBirthYear(owner, new Date().getFullYear() - 19);
  const props = await transitions.listTransitions(owner);
  assert.equal(props.length, 2, "turns_16 and turns_18 are both proposed");
  assert.ok(props.every((p) => p.status === "proposed"));
  // calling again does not duplicate
  assert.equal((await transitions.listTransitions(owner)).length, 2);
  // applying turns_18 flips the account type + clears the amount rule
  const t18 = props.find((p) => p.milestone === "turns_18");
  const res = await transitions.decideTransition(owner, t18.id, true);
  assert.equal(res.applied, true);
  assert.equal((await control.getOnboarding(owner)).accountType, "individual");
  // it is no longer a live proposal
  assert.equal((await transitions.listTransitions(owner)).some((p) => p.milestone === "turns_18"), false);
});
