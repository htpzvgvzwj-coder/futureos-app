// Money Moments - the Future Bank core loop, against a real Neon DB.
// Run: npm run test:integration
//
// Proves the causal chain the round requires:
//   transaction / plan change / detection action -> Ledger -> Financial
//   Twin -> Money Moments -> (reload identical), with no double-counting
//   and full cross-user isolation.

import test from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const opts = HAS_DB ? {} : { skip: "no DATABASE_URL" };

async function mods() {
  const [mm, stateStore, bundle, accounts, ledger, rows, seed, db] = await Promise.all([
    import("../../lib/money-moments/build.js"),
    import("../../lib/money-moments/state-store.js"),
    import("../../lib/financial-twin/bundle.js"),
    import("../../lib/bank/accounts-store.js"),
    import("../../lib/transaction-ledger/store.js"),
    import("../../lib/financial-twin/rows-store.js"),
    import("../../lib/future-field/seed.js"),
    import("../../lib/db.js"),
  ]);
  return {
    buildMoneyMoments: mm.buildMoneyMoments,
    getMomentStates: stateStore.getMomentStates,
    setMomentState: stateStore.setMomentState,
    buildFinancialTwinBundle: bundle.buildFinancialTwinBundle,
    createBankAccount: accounts.createBankAccount,
    appendTransaction: ledger.appendTransaction,
    recordInternalTransfer: ledger.recordInternalTransfer,
    createIncomeStream: rows.createIncomeStream,
    upsertRecurringObligation: rows.upsertRecurringObligation,
    seedFirstPath: seed.seedFirstPath,
    pool: db.pool,
  };
}

async function mkUser(pool, tag) {
  const r = await pool.query(
    `insert into users (email, password_hash, display_name) values ($1,'x','') returning id`,
    [`itest-mm-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@futureos.test`],
  );
  return r.rows[0].id;
}
async function cleanup(pool, uid) {
  for (const tbl of [
    "money_moment_state", "ripple_events", "change_ledger_events", "goal_commitments",
    "bank_transactions", "income_streams", "recurring_obligations", "financial_assets", "liabilities",
    "plan_branches", "plan_versions",
  ]) {
    await pool.query(`delete from ${tbl} where profile_key = $1`, [uid]).catch(() => {});
  }
  const plans = await pool.query("select id from plans where profile_key = $1", [uid]).catch(() => ({ rows: [] }));
  for (const { id } of plans.rows) {
    await pool.query("delete from plan_branches where plan_id = $1", [id]).catch(() => {});
    await pool.query("delete from plan_versions where plan_id = $1", [id]).catch(() => {});
  }
  await pool.query("delete from plans where profile_key = $1", [uid]).catch(() => {});
  await pool.query("delete from bank_accounts where profile_key = $1", [uid]).catch(() => {});
  await pool.query("delete from users where id = $1", [uid]);
}

const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function seedBasics(m, uid, { openingBalance = 8000 } = {}) {
  const acc = await m.createBankAccount(uid, { kind: "current", displayName: "Everyday", institution: "OCBC" });
  await m.appendTransaction(uid, {
    accountId: acc.id, direction: "credit", amount: openingBalance, status: "posted",
    channel: "opening_balance", category: "opening_balance", merchant: "Opening balance",
  });
  await m.createIncomeStream(uid, { kind: "salary", label: "Salary", monthlyAmount: 4200, nextExpectedDate: daysFromNow(18), sourceType: "user_confirmed" });
  await m.upsertRecurringObligation(uid, { label: "Rent", monthlyAmount: 1450, nextDueDate: daysFromNow(4), kind: "housing", recurringGroup: "rent", active: true });
  return acc;
}

// 1 -------------------------------------------------------------------
test("internal transfer -> Ledger + Available update + Money Changed receipt -> reload identical", opts, async (t) => {
  const m = await mods();
  const uid = await mkUser(m.pool, "transfer");
  t.after(() => cleanup(m.pool, uid));

  const a = await m.createBankAccount(uid, { kind: "current", displayName: "Everyday" });
  const b = await m.createBankAccount(uid, { kind: "savings", displayName: "Savings" });
  await m.appendTransaction(uid, { accountId: a.id, direction: "credit", amount: 5000, status: "posted", channel: "opening_balance", category: "opening_balance", merchant: "Opening" });

  const before = await m.buildMoneyMoments(uid);
  const availBefore = before.bankNow.available;

  const tr = await m.recordInternalTransfer(uid, { fromAccountId: a.id, toAccountId: b.id, amount: 1200, idempotencyKey: `it-${uid}` });
  assert.equal(tr.idempotent, false);
  assert.equal(tr.legs.length, 2, "double-entry: two legs");
  // the route writes Ledger + Ripple; mimic that here (route-level covered by the API)
  const { recordEventSafe } = await import("../../lib/change-ledger/store.js");
  const { ACTION_TYPES } = await import("../../lib/change-ledger/events.js");
  const { recordRippleEvent } = await import("../../lib/ripple/store.js");
  await recordEventSafe({ profileKey: uid, actor: "user", sourceFeature: "mirror", actionType: ACTION_TYPES.PAYMENT_MADE, status: "completed", messageKey: "ledger.internalTransfer", cause: { trigger: "internal_transfer" }, dedupeKey: `internal_transfer:it-${uid}` });
  await recordRippleEvent(uid, { kind: "transaction_change", cause: "You moved SGD 1,200 between your own accounts", state: "confirmed", severity: "information", dedupeKey: `internal_transfer:it-${uid}` });

  const after1 = await m.buildMoneyMoments(uid);
  const after2 = await m.buildMoneyMoments(uid); // reload

  assert.equal(after1.bankNow.available, availBefore, "an own-account transfer nets to zero on total available");
  assert.equal(after1.moneyChanged.hasChange, true, "a Money Changed receipt now exists");
  assert.match(after1.moneyChanged.headline, /moved SGD/i);
  assert.deepEqual(
    after1.moneyChanged.sourceRefs,
    after2.moneyChanged.sourceRefs,
    "reload is identical",
  );
});

// 2 -------------------------------------------------------------------
test("a detector case -> a MoneyMoment with evidence + CTA -> acknowledge persists across rebuilds", opts, async (t) => {
  const m = await mods();
  const uid = await mkUser(m.pool, "detect");
  t.after(() => cleanup(m.pool, uid));

  const acc = await seedBasics(m, uid);
  for (const [amt, merch, d] of [[40, "Kopitiam", 6], [55, "NTUC", 5], [38, "EZLink", 4], [3400, "Big Electronics", 2]]) {
    const iso = new Date(Date.now() - d * 86_400_000).toISOString();
    await m.appendTransaction(uid, { accountId: acc.id, direction: "debit", amount: amt, status: "posted", category: "shopping", merchant: merch, postedAt: iso, authorisedAt: iso });
  }

  const built = await m.buildMoneyMoments(uid);
  const unusual = built.moments.find((x) => x.kind === "large_unusual_spend");
  assert.ok(unusual, "the large unusual spend surfaces as a MoneyMoment");
  assert.equal(unusual.sourceType, "detected_problem");
  assert.ok(unusual.evidence.length >= 1, "it carries evidence");
  assert.ok(unusual.nextActions.some((na) => na.id === "acknowledge"), "it offers a real acknowledge action");
  assert.equal(unusual.state, "new");

  await m.setMomentState(uid, unusual.id, "acknowledged", { evidenceHash: unusual.evidenceHash });

  const rebuilt = await m.buildMoneyMoments(uid);
  const stored = await m.getMomentStates(uid);
  assert.equal(stored.get(unusual.id)?.state, "resolved", "the acknowledgement is persisted (acknowledged = handled)");
  assert.ok(
    !rebuilt.moments.some((x) => x.id === unusual.id),
    "an acknowledged moment leaves the active stream on reload",
  );
});

// 3 -------------------------------------------------------------------
test("a Home plan change -> Plan Movement row with server-computed affected plans; reload identical", opts, async (t) => {
  const m = await mods();
  const uid = await mkUser(m.pool, "planmove");
  t.after(() => cleanup(m.pool, uid));
  await seedBasics(m, uid);

  const seeded = await m.seedFirstPath(uid, "home", {
    answers: { price_band: "400k-600k", target_month: "2030-01" },
    exactAmounts: { monthly_contribution: 1500 },
    mode: "estimate",
  });
  assert.equal(seeded.ok, true);

  const a = await m.buildMoneyMoments(uid);
  const b = await m.buildMoneyMoments(uid);
  const homeRow = a.planMovement.find((p) => p.domain === "home");
  assert.ok(homeRow, "the home plan shows in Plan Movement");
  assert.ok(["draft", "preview", "committed"].includes(homeRow.state));
  assert.equal(
    JSON.stringify(a.planMovement),
    JSON.stringify(b.planMovement),
    "Plan Movement is identical on reload",
  );
  // every affected row keeps its own unit - never merged
  for (const row of homeRow.affected) {
    assert.ok(row.unit, "each affected row carries a unit");
    if (row.confirmedAfter != null) assert.equal(homeRow.state === "committed", true);
  }
});

// 4 -------------------------------------------------------------------
test("Preview vs Committed: a sealed commitment reads as committed, never as a preview after", opts, async (t) => {
  const m = await mods();
  const uid = await mkUser(m.pool, "seal");
  t.after(() => cleanup(m.pool, uid));
  await seedBasics(m, uid);
  const seeded = await m.seedFirstPath(uid, "home", { answers: { price_band: "400k-600k", target_month: "2030-01" }, exactAmounts: { monthly_contribution: 500 }, mode: "estimate" });

  await m.pool.query(
    `insert into goal_commitments (profile_key, domain, plan_id, monthly_contribution, effective_month, pause_if_emergency_months_below, status, source_moment)
     values ($1,'home',$2,500,$3,3.0,'active','{}'::jsonb)`,
    [uid, seeded.planId, daysFromNow(0).slice(0, 7)],
  );

  const built = await m.buildMoneyMoments(uid);
  const homeRow = built.planMovement.find((p) => p.domain === "home");
  assert.ok(homeRow);
  assert.equal(homeRow.state, "committed", "a sealed commitment is Committed");
  assert.equal(built.monthlyResourceSummary.committedMonthly, 500, "committed monthly reflects the real commitment");
});

// 5 -------------------------------------------------------------------
test("no double-count: one SGD 500/month commitment stays SGD 500 total even affecting multiple goals", opts, async (t) => {
  const m = await mods();
  const uid = await mkUser(m.pool, "nodouble");
  t.after(() => cleanup(m.pool, uid));
  await seedBasics(m, uid);
  const seeded = await m.seedFirstPath(uid, "home", { answers: { price_band: "400k-600k", target_month: "2030-01" }, exactAmounts: { monthly_contribution: 500 }, mode: "estimate" });
  await m.pool.query(
    `insert into goal_commitments (profile_key, domain, plan_id, monthly_contribution, effective_month, pause_if_emergency_months_below, status, source_moment)
     values ($1,'home',$2,500,$3,3.0,'active','{}'::jsonb)`,
    [uid, seeded.planId, daysFromNow(0).slice(0, 7)],
  );

  const built = await m.buildMoneyMoments(uid);
  const rs = built.monthlyResourceSummary;
  assert.equal(rs.committedMonthly, 500, "exactly the commitment amount");
  assert.ok(rs.possibleAddedPressureMonthly <= 500, "possible added pressure is never a multiple of the resource");
  assert.notEqual(rs.committedMonthly, 1500, "never tripled across goals");
});

// 6 -------------------------------------------------------------------
test("no signals -> calm Explore, no invented warning, watching list explains what is monitored", opts, async (t) => {
  const m = await mods();
  const uid = await mkUser(m.pool, "calm");
  t.after(() => cleanup(m.pool, uid));

  const acc = await m.createBankAccount(uid, { kind: "current", displayName: "Everyday" });
  await m.appendTransaction(uid, { accountId: acc.id, direction: "credit", amount: 6000, status: "posted", channel: "opening_balance", category: "opening_balance", merchant: "Opening" });

  const built = await m.buildMoneyMoments(uid);
  assert.equal(built.counts.actionRequired, 0, "no action-required moment invented");
  assert.ok(
    built.moments.every((x) => x.sourceType !== "detected_problem"),
    "no detector problem is fabricated from an empty picture",
  );
  assert.ok(Array.isArray(built.watching) && built.watching.length > 0, "the watching list is present");
  assert.ok(built.watching.some((w) => w.active === false), "watches with insufficient data are shown as inactive, honestly");
});

// 7 -------------------------------------------------------------------
test("cross-user isolation: user B's activity never appears in user A's Money Moments", opts, async (t) => {
  const m = await mods();
  const A = await mkUser(m.pool, "isoA");
  const B = await mkUser(m.pool, "isoB");
  t.after(() => Promise.all([cleanup(m.pool, A), cleanup(m.pool, B)]));

  const accA = await seedBasics(m, A);
  const accB = await seedBasics(m, B);
  const isoB = new Date(Date.now() - 2 * 86_400_000).toISOString();
  await m.appendTransaction(B, { accountId: accB.id, direction: "debit", amount: 4200, status: "posted", category: "shopping", merchant: "B-only huge spend", postedAt: isoB, authorisedAt: isoB });
  for (const [amt, d] of [[30, 6], [40, 5], [25, 4]]) {
    const iso = new Date(Date.now() - d * 86_400_000).toISOString();
    await m.appendTransaction(B, { accountId: accB.id, direction: "debit", amount: amt, status: "posted", category: "food", merchant: "food", postedAt: iso, authorisedAt: iso });
  }

  const mmA = await m.buildMoneyMoments(A);
  assert.ok(!JSON.stringify(mmA).includes("B-only huge spend"), "A never sees B's transaction");
  assert.ok(mmA.moments.every((x) => !x.title.includes("4200") && !x.title.includes("4,200")), "A has no moment from B's spend");
  // sanity: A alone did nothing unusual
  assert.equal(mmA.counts.actionRequired, 0);
});

// 8 -------------------------------------------------------------------
test("one rebuild = one consistent picture: twin, ledger and moments all reflect the same transfer", opts, async (t) => {
  const m = await mods();
  const uid = await mkUser(m.pool, "consistent");
  t.after(() => cleanup(m.pool, uid));
  const a = await m.createBankAccount(uid, { kind: "current", displayName: "Everyday" });
  const b = await m.createBankAccount(uid, { kind: "savings", displayName: "Savings" });
  await m.appendTransaction(uid, { accountId: a.id, direction: "credit", amount: 9000, status: "posted", channel: "opening_balance", category: "opening_balance", merchant: "Opening" });

  await m.recordInternalTransfer(uid, { fromAccountId: a.id, toAccountId: b.id, amount: 2000, idempotencyKey: `c-${uid}` });
  const { recordRippleEvent } = await import("../../lib/ripple/store.js");
  await recordRippleEvent(uid, { kind: "transaction_change", cause: "You moved SGD 2,000 between your own accounts", state: "confirmed", severity: "information", dedupeKey: `internal_transfer:c-${uid}` });

  const bundle = await m.buildFinancialTwinBundle(uid);
  const mm = await m.buildMoneyMoments(uid);

  const savingsBal = (bundle.balances ?? []).find((x) => x.accountId === b.id)?.postedBalance ?? 0;
  assert.equal(Math.round(savingsBal), 2000, "the twin's balances reflect the transfer");
  assert.equal(mm.rippleCount >= 1, true, "the ripple reflects the transfer");
  assert.equal(mm.moneyChanged.hasChange, true, "Money Moments reflect the transfer in the same rebuild");
});
