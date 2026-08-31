// Future Bank store wiring - real Neon DB. Migrations for bank_accounts /
// bank_transactions / financial_assets / liabilities / income_streams /
// recurring_obligations / ripple_events must be applied (npm run db:migrate).
// Run: npm run test:integration

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL - integration tests skipped" };

async function mods() {
  const [accounts, ledger, twinCollect, rows, ripple, db] = await Promise.all([
    import("../../lib/bank/accounts-store.js"),
    import("../../lib/transaction-ledger/store.js"),
    import("../../lib/financial-twin/collect.js"),
    import("../../lib/financial-twin/rows-store.js"),
    import("../../lib/ripple/store.js"),
    import("../../lib/db.js"),
  ]);
  return { accounts, ledger, twinCollect, rows, ripple, pool: db.pool };
}

async function cleanup(pool, pk) {
  await pool.query("delete from bank_transactions where profile_key = $1", [pk]);
  await pool.query("delete from bank_accounts where profile_key = $1", [pk]);
  await pool.query("delete from financial_assets where profile_key = $1", [pk]);
  await pool.query("delete from liabilities where profile_key = $1", [pk]);
  await pool.query("delete from income_streams where profile_key = $1", [pk]);
  await pool.query("delete from recurring_obligations where profile_key = $1", [pk]);
  await pool.query("delete from ripple_events where profile_key = $1", [pk]);
}

test("bank accounts + transactions: balances derive from the ledger; pending is a hold", opts, async (t) => {
  const { accounts, ledger, pool } = await mods();
  const pk = `itest-fb-bal-${Date.now()}`;
  t.after(() => cleanup(pool, pk));

  const cur = await accounts.createBankAccount(pk, { kind: "current", displayName: "Everyday", sourceType: "bank_synced" });
  const card = await accounts.createBankAccount(pk, { kind: "credit_card", displayName: "Visa", sourceType: "bank_synced" });
  assert.equal(card.isLiability, true);

  await ledger.appendTransaction(pk, { accountId: cur.id, direction: "credit", amount: 5000, category: "salary", channel: "salary" });
  await ledger.appendTransaction(pk, { accountId: cur.id, direction: "debit", amount: 1200, category: "rent" });
  await ledger.appendTransaction(pk, { accountId: cur.id, direction: "debit", amount: 80, category: "food", status: "pending" });
  await ledger.appendTransaction(pk, { accountId: card.id, direction: "debit", amount: 300, category: "shopping" });

  const balances = await ledger.getAccountBalances(pk);
  const curB = balances.find((b) => b.accountId === cur.id);
  const cardB = balances.find((b) => b.accountId === card.id);
  assert.equal(curB.postedBalance, 3800, "5000 - 1200 posted");
  assert.equal(curB.availableBalance, 3720, "pending 80 also held");
  assert.equal(curB.pendingAmount, 80);
  assert.equal(cardB.postedBalance, 300, "card balance = amount owed");

  assert.equal(await ledger.getSpendingTotal(pk), 1200 + 300, "rent + card purchase; not the pending 80");
  assert.equal((await ledger.reconcileLedger(pk)).ok, true);
});

test("internal transfer is atomic + idempotent; a card repayment reduces both sides and is not spending", opts, async (t) => {
  const { accounts, ledger, pool } = await mods();
  const pk = `itest-fb-xfer-${Date.now()}`;
  t.after(() => cleanup(pool, pk));

  const cur = await accounts.createBankAccount(pk, { kind: "current" });
  const sav = await accounts.createBankAccount(pk, { kind: "savings" });
  const card = await accounts.createBankAccount(pk, { kind: "credit_card" });
  await ledger.appendTransaction(pk, { accountId: cur.id, direction: "credit", amount: 4000, channel: "salary" });
  await ledger.appendTransaction(pk, { accountId: card.id, direction: "debit", amount: 450, category: "shopping" });

  const r1 = await ledger.recordInternalTransfer(pk, { fromAccountId: cur.id, toAccountId: sav.id, amount: 1000, idempotencyKey: "k-xfer-1" });
  assert.equal(r1.idempotent, false);
  assert.equal(r1.legs.length, 2);
  // replay -> no new rows
  const r2 = await ledger.recordInternalTransfer(pk, { fromAccountId: cur.id, toAccountId: sav.id, amount: 1000, idempotencyKey: "k-xfer-1" });
  assert.equal(r2.idempotent, true);

  const afterXfer = await ledger.getAccountBalances(pk);
  assert.equal(afterXfer.find((b) => b.accountId === cur.id).postedBalance, 3000);
  assert.equal(afterXfer.find((b) => b.accountId === sav.id).postedBalance, 1000);
  assert.equal(await ledger.getSpendingTotal(pk), 450, "the transfer is not spending; only the card purchase");

  const pay = await ledger.recordCardRepayment(pk, { fromAccountId: cur.id, cardAccountId: card.id, amount: 450, idempotencyKey: "k-pay-1" });
  assert.equal(pay.idempotent, false);
  const afterPay = await ledger.getAccountBalances(pk);
  assert.equal(afterPay.find((b) => b.accountId === cur.id).postedBalance, 2550, "current down by the payment");
  assert.equal(afterPay.find((b) => b.accountId === card.id).postedBalance, 0, "card cleared");
  assert.equal(await ledger.getSpendingTotal(pk), 450, "still exactly one spend");
  assert.equal((await ledger.reconcileLedger(pk)).ok, true);

  // replaying the repayment is a no-op
  const pay2 = await ledger.recordCardRepayment(pk, { fromAccountId: cur.id, cardAccountId: card.id, amount: 450, idempotencyKey: "k-pay-1" });
  assert.equal(pay2.idempotent, true);
  assert.equal((await ledger.getAccountBalances(pk)).find((b) => b.accountId === cur.id).postedBalance, 2550);
});

test("reversing a posted transaction adds an opposite entry; the original row is untouched", opts, async (t) => {
  const { accounts, ledger, pool } = await mods();
  const pk = `itest-fb-rev-${Date.now()}`;
  t.after(() => cleanup(pool, pk));

  const cur = await accounts.createBankAccount(pk, { kind: "current" });
  await ledger.appendTransaction(pk, { accountId: cur.id, direction: "credit", amount: 1000, channel: "salary" });
  const spend = await ledger.appendTransaction(pk, { accountId: cur.id, direction: "debit", amount: 200, category: "food" });

  const { reversal, original } = await ledger.reverseTransaction(pk, spend.id, { reason: "merchant refund" });
  assert.equal(reversal.reversalOf, spend.id);
  assert.equal(reversal.direction, "credit");
  assert.equal(original.id, spend.id);

  const stillThere = await pool.query("select status, amount from bank_transactions where id = $1", [spend.id]);
  assert.equal(stillThere.rows[0].status, "posted", "the original is not mutated");
  assert.equal(Number(stillThere.rows[0].amount), 200);

  assert.equal((await ledger.getAccountBalances(pk)).find((b) => b.accountId === cur.id).postedBalance, 1000, "reversal nets the spend out");
  assert.equal(await ledger.getSpendingTotal(pk), 0, "a reversed spend is not spending");

  await assert.rejects(() => ledger.reverseTransaction(pk, spend.id), /already reversed/);
});

test("loadFinancialTwin composes accounts + assets + liabilities + income + commitments; two users isolated; reload-consistent", opts, async (t) => {
  const { accounts, ledger, twinCollect, rows, pool } = await mods();
  const pkA = `itest-fb-twinA-${Date.now()}`;
  const pkB = `itest-fb-twinB-${Date.now()}`;
  t.after(async () => {
    await cleanup(pool, pkA);
    await cleanup(pool, pkB);
  });

  // fresh user -> empty twin, no persona
  const empty = await twinCollect.loadFinancialTwin(pkA);
  assert.equal(empty.isEmpty, true);
  assert.equal(empty.netWorth, 0);
  assert.equal(JSON.stringify(empty).includes("85000"), false);

  // user A: a current account with 12k, CPF SA (restricted), a mortgage, salary, a subscription
  const curA = await accounts.createBankAccount(pkA, { kind: "current", sourceType: "bank_synced" });
  await ledger.appendTransaction(pkA, { accountId: curA.id, direction: "credit", amount: 12000, channel: "salary" });
  await rows.createFinancialAsset(pkA, { assetClass: "cpf_sa_ra", currentValue: 90000, liquidityClass: "cash", sourceType: "government_linked" });
  await rows.createLiability(pkA, { liabilityClass: "mortgage", currentBalance: 300000, minimumMonthly: 1600, sourceType: "bank_synced" });
  await rows.createIncomeStream(pkA, { kind: "salary", monthlyAmount: 8000, sourceType: "bank_synced" });
  await rows.upsertRecurringObligation(pkA, { kind: "subscription", label: "Streaming", monthlyAmount: 30, recurringGroup: "rg-stream" });
  await pool.query(
    `insert into goal_commitments
       (profile_key, domain, monthly_contribution, effective_month, pause_if_emergency_months_below, status, source_moment)
     values ($1,'wedding',500,'2026-09',0,'active','{}'::jsonb)`,
    [pkA],
  );

  const twinA = await twinCollect.loadFinancialTwin(pkA);
  assert.equal(twinA.isEmpty, false);
  assert.equal(twinA.financialAssetsTotal, 12000 + 90000);
  assert.equal(twinA.liabilitiesTotal, 300000);
  assert.equal(twinA.netWorth, 12000 + 90000 - 300000);
  assert.equal(twinA.liquidAssets, 12000, "CPF SA/RA is never liquid");
  assert.equal(twinA.restrictedAssets, 90000);
  assert.equal(twinA.monthlyIncome, 8000);
  // free cashflow = 8000 - (subscription 30) - (mortgage min 1600) - (wedding commitment 500)
  assert.equal(twinA.monthlyFreeCashflow, 8000 - 30 - 1600 - 500);
  assert.equal(twinA.committedMonthlyTotal, 500);

  // user B is untouched by user A
  const twinB = await twinCollect.loadFinancialTwin(pkB);
  assert.equal(twinB.isEmpty, true);
  assert.equal(twinB.netWorth, 0);

  // reload -> identical numbers (asOf is a fresh timestamp each call)
  const twinA2 = await twinCollect.loadFinancialTwin(pkA);
  const strip = (x) => {
    const { asOf, ...rest } = x;
    void asOf;
    return rest;
  };
  assert.deepEqual(strip(twinA2), strip(twinA));
});

test("ripple_events: a possible ripple is superseded by a confirmed one; dedupe keeps one active row; history kept", opts, async (t) => {
  const { ripple, pool } = await mods();
  const pk = `itest-fb-ripple-${Date.now()}`;
  t.after(() => cleanup(pool, pk));

  await ripple.recordRippleEvent(pk, {
    kind: "studio_impact", domain: "wedding", cause: "guest_count 90 -> 150", monthlyDelta: 280,
    affectedGoals: [{ goalId: "home", direction: "down" }], state: "possible", severity: "turning_point",
    dedupeKey: "wedding:guest_count",
  });
  // a re-run with the same dedupe key supersedes the first, still one active
  await ripple.recordRippleEvent(pk, {
    kind: "studio_impact", domain: "wedding", cause: "guest_count 90 -> 160", monthlyDelta: 320,
    state: "possible", dedupeKey: "wedding:guest_count",
  });
  let active = await ripple.listRippleEvents(pk);
  assert.equal(active.length, 1);
  assert.equal(active[0].monthlyDelta, 320);
  const all = await ripple.listRippleEvents(pk, { includeInactive: true });
  assert.ok(all.length >= 2, "the superseded row is kept for history");

  // seal -> the domain ripple becomes confirmed
  const confirmed = await ripple.confirmDomainRipple(pk, "wedding", { snapshotId: "snap-x" });
  assert.ok(confirmed.length >= 1);
  active = await ripple.listRippleEvents(pk);
  assert.equal(active[0].state, "confirmed");

  // revoke -> back out
  await ripple.revokeDomainRipple(pk, "wedding");
  active = await ripple.listRippleEvents(pk);
  assert.equal(active.filter((r) => r.state === "confirmed").length, 0);
});
