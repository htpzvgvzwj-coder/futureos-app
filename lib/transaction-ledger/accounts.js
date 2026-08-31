// Transaction Ledger - account kinds and the sign rules that keep a
// bank-grade ledger honest (Future Bank round, section 五 / 十).
//
// Pure: no DB, no network.

export const ACCOUNT_KINDS = ["current", "savings", "fixed_deposit", "credit_card", "multi_currency", "goal_wallet"];

// A credit_card account's "balance" is money OWED (a liability). Every
// other kind's balance is money HELD (an asset). This sign convention is
// applied once, here, so no caller has to remember it.
export function isLiabilityAccount(kind) {
  return kind === "credit_card";
}

export const TXN_DIRECTIONS = ["debit", "credit"]; // debit = out of / against the account, credit = into it
export const TXN_STATUSES = ["pending", "posted", "reversed", "failed"];

// A transaction's effect on the account's *reported balance*, given the
// account kind and the direction. Returns a signed number to add to the
// running balance when the txn is POSTED.
//   asset account:      credit -> +amount, debit -> -amount
//   liability account:  debit  -> +owed  , credit -> -owed   (a card
//                       purchase is a `debit` that raises what you owe;
//                       a card payment is a `credit` that lowers it)
export function balanceEffect({ accountKind, direction, amount }) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a < 0) throw new Error("amount must be a non-negative number");
  const liability = isLiabilityAccount(accountKind);
  if (direction === "credit") return liability ? -a : a;
  if (direction === "debit") return liability ? a : -a;
  throw new Error(`unknown direction: ${direction}`);
}

// Only these statuses move the *reported* (posted) balance. `pending`
// affects only the *available* balance (a hold), never posted totals or
// spending analytics.
export function affectsPostedBalance(status) {
  return status === "posted";
}
export function affectsAvailableBalance(status) {
  return status === "pending" || status === "posted";
}
