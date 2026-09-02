import test from "node:test";
import assert from "node:assert/strict";
import {
  accountBalance,
  spendingTotal,
  dedupeIdempotent,
  buildInternalTransfer,
  buildCardRepayment,
  buildReversal,
  reconcile,
} from "../lib/transaction-ledger/ledger.js";
import { balanceEffect, isLiabilityAccount } from "../lib/transaction-ledger/accounts.js";

const e = (o) => ({ currency: "SGD", status: "posted", ...o });

test("pending is a hold: it moves the available balance but never the posted balance", () => {
  const entries = [
    e({ id: "1", accountId: "acc", accountKind: "current", direction: "credit", amount: 1000 }),
    e({ id: "2", accountId: "acc", accountKind: "current", direction: "debit", amount: 200, status: "pending" }),
  ];
  const b = accountBalance("acc", entries);
  assert.equal(b.postedBalance, 1000, "the pending debit has not posted");
  assert.equal(b.availableBalance, 800, "but it is held against available");
  assert.equal(b.pendingAmount, 200);
});

test("pending -> posted moves the posted balance; it is one entry transitioning, not two", () => {
  const posted = [e({ id: "2", accountId: "acc", accountKind: "current", direction: "debit", amount: 200, status: "posted" })];
  const b = accountBalance("acc", [e({ id: "1", accountId: "acc", accountKind: "current", direction: "credit", amount: 1000 }), ...posted]);
  assert.equal(b.postedBalance, 800);
  assert.equal(b.availableBalance, 800);
});

test("posted -> reversed: the original stays, an opposite entry nets it out", () => {
  const orig = e({ id: "p1", accountId: "acc", accountKind: "current", direction: "debit", amount: 150, category: "food" });
  const rev = buildReversal(orig);
  assert.equal(rev.direction, "credit");
  assert.equal(rev.reversalOf, "p1");
  const b = accountBalance("acc", [e({ id: "c0", accountId: "acc", accountKind: "current", direction: "credit", amount: 500 }), orig, rev]);
  assert.equal(b.postedBalance, 500, "the reversal cancels the original; neither is deleted");
  assert.equal(spendingTotal([orig, rev]), 0, "a reversed spend is not spending");
});

test("an internal transfer is double-entry and is NOT spending", () => {
  const legs = buildInternalTransfer({
    fromAccountId: "cur", fromKind: "current", toAccountId: "sav", toKind: "savings",
    amount: 300, idempotencyKey: "xfer-1", transferId: "t1",
  });
  assert.equal(legs.length, 2);
  const seed = [
    e({ id: "s1", accountId: "cur", accountKind: "current", direction: "credit", amount: 1000 }),
  ];
  const all = [...seed, ...legs];
  assert.equal(accountBalance("cur", all).postedBalance, 700);
  assert.equal(accountBalance("sav", all).postedBalance, 300);
  assert.equal(spendingTotal(all), 0, "moving your own money is not spending");
  assert.equal(reconcile(all, ["cur", "sav"]).ok, true, "the two legs reconcile to zero net");
});

test("a credit-card PURCHASE raises card debt and does NOT touch the deposit account", () => {
  const all = [
    e({ id: "d1", accountId: "cur", accountKind: "current", direction: "credit", amount: 2000 }),
    e({ id: "c1", accountId: "card", accountKind: "credit_card", direction: "debit", amount: 450, category: "shopping" }),
  ];
  assert.equal(accountBalance("cur", all).postedBalance, 2000, "the current account is untouched");
  assert.equal(accountBalance("card", all).postedBalance, 450, "card balance = amount OWED");
  assert.equal(spendingTotal(all), 450, "the card purchase IS spending, counted once");
});

test("a credit-card PAYMENT reduces the deposit AND the card debt, and is not spending", () => {
  const purchase = [
    e({ id: "d1", accountId: "cur", accountKind: "current", direction: "credit", amount: 2000 }),
    e({ id: "c1", accountId: "card", accountKind: "credit_card", direction: "debit", amount: 450, category: "shopping" }),
  ];
  const pay = buildCardRepayment({ fromAccountId: "cur", fromKind: "current", cardAccountId: "card", amount: 450, idempotencyKey: "pay-1", transferId: "r1" });
  const all = [...purchase, ...pay];
  assert.equal(accountBalance("cur", all).postedBalance, 1550, "deposit down by the payment");
  assert.equal(accountBalance("card", all).postedBalance, 0, "card debt cleared");
  assert.equal(spendingTotal(all), 450, "still exactly one spend (the purchase), the payment is not counted again");
});

test("Pay / Transfer idempotency: replaying the same key is a no-op", () => {
  const legA = buildInternalTransfer({ fromAccountId: "cur", fromKind: "current", toAccountId: "sav", toKind: "savings", amount: 100, idempotencyKey: "k1", transferId: "t1" });
  // a naive client retries and the SAME logical transfer arrives again
  const legB = buildInternalTransfer({ fromAccountId: "cur", fromKind: "current", toAccountId: "sav", toKind: "savings", amount: 100, idempotencyKey: "k1", transferId: "t2" });
  const seed = [e({ id: "s", accountId: "cur", accountKind: "current", direction: "credit", amount: 500 })];
  const all = dedupeIdempotent([...seed, ...legA, ...legB]);
  assert.equal(accountBalance("cur", all).postedBalance, 400, "only ONE transfer took effect");
  assert.equal(accountBalance("sav", all).postedBalance, 100);
});

test("account balance reconciles with the ledger; spending totals reconcile with posted debits", () => {
  const all = [
    e({ id: "1", accountId: "cur", accountKind: "current", direction: "credit", amount: 5000, category: "salary" }),
    e({ id: "2", accountId: "cur", accountKind: "current", direction: "debit", amount: 1200, category: "rent" }),
    e({ id: "3", accountId: "card", accountKind: "credit_card", direction: "debit", amount: 300, category: "food" }),
    ...buildInternalTransfer({ fromAccountId: "cur", fromKind: "current", toAccountId: "sav", toKind: "savings", amount: 800, idempotencyKey: "x", transferId: "t9" }),
    e({ id: "4", accountId: "cur", accountKind: "current", direction: "debit", amount: 50, category: "food", status: "pending" }),
  ];
  assert.equal(accountBalance("cur", all).postedBalance, 5000 - 1200 - 800);
  assert.equal(accountBalance("cur", all).availableBalance, 5000 - 1200 - 800 - 50);
  assert.equal(accountBalance("sav", all).postedBalance, 800);
  assert.equal(accountBalance("card", all).postedBalance, 300);
  // spending = rent + card food (NOT the transfer, NOT the pending 50)
  assert.equal(spendingTotal(all), 1200 + 300);
  assert.equal(reconcile(all, ["cur", "sav", "card"]).ok, true);
});

test("balanceEffect sign convention: asset vs liability account", () => {
  assert.equal(balanceEffect({ accountKind: "current", direction: "credit", amount: 100 }), 100);
  assert.equal(balanceEffect({ accountKind: "current", direction: "debit", amount: 100 }), -100);
  assert.equal(balanceEffect({ accountKind: "credit_card", direction: "debit", amount: 100 }), 100, "a card purchase raises what you owe");
  assert.equal(balanceEffect({ accountKind: "credit_card", direction: "credit", amount: 100 }), -100, "a card payment lowers it");
  assert.equal(isLiabilityAccount("credit_card"), true);
  assert.equal(isLiabilityAccount("savings"), false);
  assert.throws(() => balanceEffect({ accountKind: "current", direction: "debit", amount: -5 }), /non-negative/);
});
