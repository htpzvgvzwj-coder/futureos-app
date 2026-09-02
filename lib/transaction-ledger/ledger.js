// Transaction Ledger - the accounting core (Future Bank round, section 五).
//
// Pure, deterministic reducers over an ordered list of ledger entries.
// The DB store (a later commit) is thin: it appends immutable entries and
// calls these functions to derive balances and analytics. NOTHING mutates
// an entry in place - a reversal is a NEW entry that points at the
// original.
//
// Financial-consistency rules enforced here:
//   - pending never enters posted balance or spending totals
//   - posted moves the reported balance
//   - reversed produces an equal-and-opposite entry; the original stays
//   - an internal transfer is DOUBLE-ENTRY (a debit leg + a credit leg
//     sharing one transferId) and is never counted as spending
//   - a credit-card purchase raises card debt, does NOT reduce a deposit
//   - a credit-card payment reduces the deposit AND the card debt, and is
//     not spending
//   - Pay / Transfer carry an idempotencyKey; a replay is a no-op
//
// No DB, no network, no Date.now.

import { balanceEffect, isLiabilityAccount, affectsPostedBalance, affectsAvailableBalance } from "./accounts.js";

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("non-finite amount");
  // integer minor units are the safe representation; callers pass whole
  // cents or whole dollars consistently. We just guard precision.
  return Math.round(n * 100) / 100;
}

// entry shape:
// { id, accountId, accountKind, direction, amount, currency, status,
//   category?, channel?, transferId?, reversalOf?, idempotencyKey?,
//   isInternalTransfer?, isCardRepayment?, authorisedAt?, postedAt? }

// Drop replayed idempotent writes. A single idempotencyKey may legitimately
// carry MULTIPLE entries when they belong to ONE physical operation (the
// two legs of a transfer share a key + a transferId). A later arrival with
// the same key but a DIFFERENT physical operation is the replay - dropped.
export function dedupeIdempotent(entries = []) {
  const firstOpForKey = new Map();
  const out = [];
  for (const e of entries) {
    if (e.idempotencyKey) {
      const opId = e.transferId ?? e.id ?? null;
      const seen = firstOpForKey.get(e.idempotencyKey);
      if (seen === undefined) firstOpForKey.set(e.idempotencyKey, opId);
      else if (opId !== seen) continue; // a replay of a different op with the same key
    }
    out.push(e);
  }
  return out;
}

// Reported (posted) + available balance for one account. A reversal is a
// real posted entry with the opposite effect; both the original and the
// reversal are counted and they net to zero - nothing is deleted.
export function accountBalance(accountId, entries = []) {
  const list = dedupeIdempotent(entries).filter((e) => e.accountId === accountId);

  let posted = 0;
  let available = 0;
  let pending = 0;
  let kind = null;
  for (const e of list) {
    kind = e.accountKind ?? kind;
    if (e.status === "failed") continue;
    const effect = balanceEffect({ accountKind: e.accountKind, direction: e.direction, amount: e.amount });
    if (affectsPostedBalance(e.status)) posted += effect;
    if (affectsAvailableBalance(e.status)) available += effect;
    if (e.status === "pending") pending += Math.abs(effect);
  }
  return {
    accountId,
    accountKind: kind,
    isLiability: kind ? isLiabilityAccount(kind) : false,
    postedBalance: money(posted),
    availableBalance: money(available),
    pendingAmount: money(pending),
  };
}

// Sum of genuine outgoing spending in a window: POSTED debits from asset
// accounts and POSTED card purchases, EXCLUDING internal transfers and
// card repayments. Reversed entries net out.
export function spendingTotal(entries = [], { from = null, to = null } = {}) {
  const list = dedupeIdempotent(entries);
  let total = 0;
  for (const e of list) {
    if (e.status !== "posted") continue;
    if (e.isInternalTransfer || e.transferId) continue; // moving your own money is not spending
    if (e.isCardRepayment) continue; // paying the card is not new spending
    const when = e.postedAt ?? e.authorisedAt ?? null;
    if (from && when && when < from) continue;
    if (to && when && when > to) continue;
    // asset account: a debit is spending. card: a purchase (debit) is spending.
    if (e.direction === "debit") total += money(e.amount);
    // a reversal of a prior spend (a credit pointing at a debit) nets it out
    if (e.reversalOf && e.direction === "credit") total -= money(e.amount);
  }
  return money(total);
}

// Build the two legs of an internal transfer. They share one transferId,
// carry the idempotencyKey on BOTH legs (a replay of either is caught),
// and are flagged so spending never counts them.
export function buildInternalTransfer({ fromAccountId, fromKind, toAccountId, toKind, amount, currency = "SGD", idempotencyKey, transferId, authorisedAt = null }) {
  const amt = money(amount);
  if (amt <= 0) throw new Error("transfer amount must be positive");
  const base = { amount: amt, currency, status: "posted", isInternalTransfer: true, transferId, idempotencyKey, authorisedAt };
  return [
    { ...base, id: `${transferId}:out`, accountId: fromAccountId, accountKind: fromKind, direction: "debit" },
    { ...base, id: `${transferId}:in`, accountId: toAccountId, accountKind: toKind, direction: "credit" },
  ];
}

// A credit-card repayment: a debit from the funding deposit account + a
// credit against the card (lowering what is owed). Double-entry, flagged
// as a repayment so it is never spending.
export function buildCardRepayment({ fromAccountId, fromKind, cardAccountId, amount, currency = "SGD", idempotencyKey, transferId, authorisedAt = null }) {
  const amt = money(amount);
  if (amt <= 0) throw new Error("repayment amount must be positive");
  const base = { amount: amt, currency, status: "posted", isCardRepayment: true, transferId, idempotencyKey, authorisedAt };
  return [
    { ...base, id: `${transferId}:from`, accountId: fromAccountId, accountKind: fromKind, direction: "debit" },
    { ...base, id: `${transferId}:card`, accountId: cardAccountId, accountKind: "credit_card", direction: "credit" },
  ];
}

// A reversal entry for a posted transaction. Same account, opposite
// direction, same amount, status posted, pointing at the original.
export function buildReversal(original, { id = null, postedAt = null } = {}) {
  if (!original || !original.id) throw new Error("cannot reverse an entry with no id");
  return {
    id: id ?? `${original.id}:rev`,
    accountId: original.accountId,
    accountKind: original.accountKind,
    direction: original.direction === "debit" ? "credit" : "debit",
    amount: money(original.amount),
    currency: original.currency ?? "SGD",
    status: "posted",
    reversalOf: original.id,
    category: original.category ?? null,
    channel: original.channel ?? null,
    isInternalTransfer: Boolean(original.isInternalTransfer),
    transferId: original.transferId ?? null,
    isCardRepayment: Boolean(original.isCardRepayment),
    postedAt,
  };
}

// Reconcile: the sum of every account's posted balance must equal the sum
// of all posted signed effects (no entry lost, no double count). Returns
// { ok, drift }.
export function reconcile(entries = [], accountIds = []) {
  const perAccount = accountIds.map((id) => accountBalance(id, entries).postedBalance);
  const sumBalances = money(perAccount.reduce((s, v) => s + v, 0));

  const list = dedupeIdempotent(entries);
  let sumEffects = 0;
  for (const e of list) {
    if (e.status !== "posted") continue;
    sumEffects += balanceEffect({ accountKind: e.accountKind, direction: e.direction, amount: e.amount });
  }
  sumEffects = money(sumEffects);
  return { ok: Math.abs(sumBalances - sumEffects) < 0.005, sumBalances, sumEffects, drift: money(sumBalances - sumEffects) };
}
