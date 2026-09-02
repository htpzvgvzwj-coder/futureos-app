// Transaction Ledger store - append-only writes to bank_transactions, and
// balance / spending reads derived through the PURE reducers in ledger.js
// (never recomputed ad hoc). Money-moving writes (transfer, card
// repayment) are atomic and idempotent.

import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../db.js";
import { ACCOUNT_KINDS, TXN_DIRECTIONS, TXN_STATUSES } from "./accounts.js";
import {
  accountBalance,
  spendingTotal,
  buildInternalTransfer,
  buildCardRepayment,
  buildReversal,
  reconcile,
} from "./ledger.js";

const COLS = `id, profile_key, account_id, direction, amount, currency, original_amount, original_currency,
  fx_rate, status, category, channel, merchant, counterparty_masked, reference, transfer_id, reversal_of,
  is_internal_transfer, is_card_repayment, recurring_group, idempotency_key, source_type,
  authorised_at, posted_at, created_at`;

function mapRow(r) {
  return {
    id: r.id,
    accountId: r.account_id,
    accountKind: r._account_kind ?? null, // joined in listers
    direction: r.direction,
    amount: Number(r.amount),
    currency: r.currency,
    originalAmount: r.original_amount == null ? null : Number(r.original_amount),
    originalCurrency: r.original_currency,
    fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
    status: r.status,
    category: r.category,
    channel: r.channel,
    merchant: r.merchant,
    counterpartyMasked: r.counterparty_masked,
    reference: r.reference,
    transferId: r.transfer_id,
    reversalOf: r.reversal_of,
    isInternalTransfer: r.is_internal_transfer,
    isCardRepayment: r.is_card_repayment,
    recurringGroup: r.recurring_group,
    idempotencyKey: r.idempotency_key,
    sourceType: r.source_type,
    authorisedAt: r.authorised_at,
    postedAt: r.posted_at,
    createdAt: r.created_at,
  };
}

// entries for the pure reducers need accountKind on every row.
async function loadEntries(profileKey, { accountId = null } = {}) {
  const res = await query(
    `select t.*, a.kind as _account_kind
     from bank_transactions t join bank_accounts a on a.id = t.account_id
     where t.profile_key = $1 ${accountId ? "and t.account_id = $2" : ""}
     order by coalesce(t.posted_at, t.authorised_at, t.created_at) asc, t.created_at asc`,
    accountId ? [profileKey, accountId] : [profileKey],
  );
  return res.rows.map(mapRow);
}

// --- reads -----------------------------------------------------------

export async function listTransactions(profileKey, { accountId = null, limit = 50 } = {}) {
  const res = await query(
    `select t.*, a.kind as _account_kind
     from bank_transactions t join bank_accounts a on a.id = t.account_id
     where t.profile_key = $1 ${accountId ? "and t.account_id = $2" : ""}
     order by coalesce(t.posted_at, t.authorised_at, t.created_at) desc, t.created_at desc
     limit ${Number(limit) || 50}`,
    accountId ? [profileKey, accountId] : [profileKey],
  );
  return res.rows.map(mapRow);
}

export async function getAccountBalances(profileKey) {
  const [accRes, entries] = await Promise.all([
    query(`select id, kind, currency, display_name, is_liability from bank_accounts where profile_key = $1 and status = 'active'`, [profileKey]),
    loadEntries(profileKey),
  ]);
  return accRes.rows.map((a) => {
    const b = accountBalance(a.id, entries);
    return {
      accountId: a.id,
      kind: a.kind,
      currency: a.currency,
      displayName: a.display_name,
      isLiability: a.is_liability,
      postedBalance: b.postedBalance,
      availableBalance: b.availableBalance,
      pendingAmount: b.pendingAmount,
    };
  });
}

export async function getSpendingTotal(profileKey, { from = null, to = null } = {}) {
  const entries = await loadEntries(profileKey);
  return spendingTotal(entries, { from, to });
}

export async function reconcileLedger(profileKey) {
  const [accRes, entries] = await Promise.all([
    query(`select id from bank_accounts where profile_key = $1`, [profileKey]),
    loadEntries(profileKey),
  ]);
  return reconcile(entries, accRes.rows.map((r) => r.id));
}

// --- writes --------------------------------------------------------

function assertEntry(e) {
  if (!TXN_DIRECTIONS.includes(e.direction)) throw new Error(`bad direction: ${e.direction}`);
  if (!TXN_STATUSES.includes(e.status ?? "posted")) throw new Error(`bad status: ${e.status}`);
  if (!(Number(e.amount) >= 0)) throw new Error("amount must be a non-negative number");
}

async function insertEntry(runner, profileKey, e) {
  assertEntry(e);
  const res = await runner.query(
    `insert into bank_transactions
       (profile_key, account_id, direction, amount, currency, original_amount, original_currency, fx_rate,
        status, category, channel, merchant, counterparty_masked, reference, transfer_id, reversal_of,
        is_internal_transfer, is_card_repayment, recurring_group, idempotency_key, source_type,
        authorised_at, posted_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     returning ${COLS}`,
    [
      profileKey,
      e.accountId,
      e.direction,
      e.amount,
      e.currency ?? "SGD",
      e.originalAmount ?? null,
      e.originalCurrency ?? null,
      e.fxRate ?? null,
      e.status ?? "posted",
      e.category ?? null,
      e.channel ?? null,
      e.merchant ?? null,
      e.counterpartyMasked ?? null,
      e.reference ?? null,
      e.transferId ?? null,
      e.reversalOf ?? null,
      Boolean(e.isInternalTransfer),
      Boolean(e.isCardRepayment),
      e.recurringGroup ?? null,
      e.idempotencyKey ?? null,
      e.sourceType ?? "user_confirmed",
      e.authorisedAt ?? (e.status === "posted" ? new Date().toISOString() : null),
      e.postedAt ?? (e.status === "posted" ? new Date().toISOString() : null),
    ],
  );
  return mapRow(res.rows[0]);
}

// A single standalone entry (a card purchase, a salary credit, a pending hold).
export async function appendTransaction(profileKey, input) {
  return insertEntry({ query: (t, p) => query(t, p) }, profileKey, input);
}

async function accountsFor(runner, profileKey, ids) {
  const res = await runner.query(
    `select id, kind from bank_accounts where profile_key = $1 and id = any($2::uuid[]) for update`,
    [profileKey, ids],
  );
  const byId = Object.fromEntries(res.rows.map((r) => [r.id, r.kind]));
  for (const id of ids) if (!byId[id]) throw new Error(`account ${id} not found for this user`);
  return byId;
}

// Atomic double-entry internal transfer. Idempotent: a replay under the
// same idempotencyKey returns the original transfer's legs, writes nothing.
export async function recordInternalTransfer(profileKey, { fromAccountId, toAccountId, amount, idempotencyKey, currency = "SGD", authorisedAt = null }) {
  if (!idempotencyKey) throw new Error("idempotencyKey is required for a transfer");
  if (fromAccountId === toAccountId) throw new Error("cannot transfer to the same account");

  const existing = await query(
    `select ${COLS} from bank_transactions where profile_key = $1 and idempotency_key = $2 and is_internal_transfer = true order by created_at asc`,
    [profileKey, idempotencyKey],
  );
  if (existing.rows.length > 0) return { idempotent: true, legs: existing.rows.map(mapRow) };

  return withTransaction(async (tx) => {
    const kinds = await accountsFor(tx, profileKey, [fromAccountId, toAccountId]);
    const transferId = randomUUID();
    const [outLeg, inLeg] = buildInternalTransfer({
      fromAccountId, fromKind: kinds[fromAccountId],
      toAccountId, toKind: kinds[toAccountId],
      amount, currency, idempotencyKey, transferId, authorisedAt,
    });
    try {
      const a = await insertEntry(tx, profileKey, { ...outLeg, channel: "transfer" });
      const b = await insertEntry(tx, profileKey, { ...inLeg, channel: "transfer" });
      return { idempotent: false, legs: [a, b] };
    } catch (err) {
      if (err?.code === "23505") {
        const rows = await tx.query(
          `select ${COLS} from bank_transactions where profile_key = $1 and idempotency_key = $2 order by created_at asc`,
          [profileKey, idempotencyKey],
        );
        return { idempotent: true, legs: rows.rows.map(mapRow) };
      }
      throw err;
    }
  });
}

// Atomic card repayment: a debit from the funding account + a credit
// against the card. Not counted as spending.
export async function recordCardRepayment(profileKey, { fromAccountId, cardAccountId, amount, idempotencyKey, currency = "SGD", authorisedAt = null }) {
  if (!idempotencyKey) throw new Error("idempotencyKey is required for a card repayment");
  const existing = await query(
    `select ${COLS} from bank_transactions where profile_key = $1 and idempotency_key = $2 and is_card_repayment = true order by created_at asc`,
    [profileKey, idempotencyKey],
  );
  if (existing.rows.length > 0) return { idempotent: true, legs: existing.rows.map(mapRow) };

  return withTransaction(async (tx) => {
    const kinds = await accountsFor(tx, profileKey, [fromAccountId, cardAccountId]);
    if (kinds[cardAccountId] !== "credit_card") throw new Error("target is not a credit card account");
    const transferId = randomUUID();
    const [from, card] = buildCardRepayment({
      fromAccountId, fromKind: kinds[fromAccountId], cardAccountId, amount, currency, idempotencyKey, transferId, authorisedAt,
    });
    try {
      const a = await insertEntry(tx, profileKey, { ...from, channel: "transfer" });
      const b = await insertEntry(tx, profileKey, { ...card, channel: "transfer" });
      return { idempotent: false, legs: [a, b] };
    } catch (err) {
      if (err?.code === "23505") {
        const rows = await tx.query(
          `select ${COLS} from bank_transactions where profile_key = $1 and idempotency_key = $2 order by created_at asc`,
          [profileKey, idempotencyKey],
        );
        return { idempotent: true, legs: rows.rows.map(mapRow) };
      }
      throw err;
    }
  });
}

// Reverse a posted transaction: a NEW opposite entry pointing at it. The
// original row is never mutated or deleted.
export async function reverseTransaction(profileKey, transactionId, { reason = null } = {}) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `select t.*, a.kind as _account_kind from bank_transactions t join bank_accounts a on a.id = t.account_id
       where t.id = $1 and t.profile_key = $2 for update`,
      [transactionId, profileKey],
    );
    if (res.rows.length === 0) throw new Error("transaction not found");
    const original = mapRow(res.rows[0]);
    if (original.status !== "posted") throw new Error(`only a posted transaction can be reversed (is ${original.status})`);
    const already = await tx.query(`select id from bank_transactions where reversal_of = $1`, [transactionId]);
    if (already.rows.length > 0) throw new Error("transaction already reversed");

    const rev = buildReversal(original);
    const inserted = await insertEntry(tx, profileKey, { ...rev, reference: reason ?? original.reference });
    return { reversal: inserted, original };
  });
}
