// bank_accounts store - the customer's real accounts (current / savings /
// fixed deposit / credit card / multi-currency / goal wallet).
//
// Balances are NOT stored on the row - they are derived from
// bank_transactions via lib/transaction-ledger. This table is just the
// account's identity, kind, currency and provenance.

import { query } from "../db.js";
import { ACCOUNT_KINDS, isLiabilityAccount } from "../transaction-ledger/accounts.js";
import { SOURCE_TYPES } from "../financial-twin/classes.js";

function mapRow(r) {
  return {
    id: r.id,
    profileKey: r.profile_key,
    kind: r.kind,
    displayName: r.display_name,
    institution: r.institution,
    currency: r.currency,
    maskedNumber: r.masked_number,
    isLiability: r.is_liability,
    creditLimit: r.credit_limit == null ? null : Number(r.credit_limit),
    goalDomain: r.goal_domain,
    status: r.status,
    sourceType: r.source_type,
    sourceName: r.source_name,
    openedAt: r.opened_at,
    asOf: r.as_of,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listBankAccounts(profileKey, { includeClosed = false } = {}) {
  const res = await query(
    `select * from bank_accounts
     where profile_key = $1 ${includeClosed ? "" : "and status = 'active'"}
     order by is_liability asc, created_at asc`,
    [profileKey],
  );
  return res.rows.map(mapRow);
}

export async function getBankAccount(profileKey, id) {
  const res = await query(`select * from bank_accounts where id = $1 and profile_key = $2`, [id, profileKey]);
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function createBankAccount(profileKey, input = {}) {
  const kind = input.kind;
  if (!ACCOUNT_KINDS.includes(kind)) throw new Error(`invalid account kind: ${kind}`);
  const sourceType = SOURCE_TYPES.includes(input.sourceType) ? input.sourceType : "user_confirmed";
  const res = await query(
    `insert into bank_accounts
       (profile_key, kind, display_name, institution, currency, masked_number,
        is_liability, credit_limit, goal_domain, status, source_type, source_name, opened_at, last_synced_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning *`,
    [
      profileKey,
      kind,
      input.displayName ?? "",
      input.institution ?? null,
      input.currency ?? "SGD",
      input.maskedNumber ?? null,
      isLiabilityAccount(kind),
      input.creditLimit ?? null,
      input.goalDomain ?? null,
      input.status ?? "active",
      sourceType,
      input.sourceName ?? null,
      input.openedAt ?? null,
      input.lastSyncedAt ?? null,
    ],
  );
  return mapRow(res.rows[0]);
}

export async function updateBankAccount(profileKey, id, patch = {}) {
  const res = await query(
    `update bank_accounts set
       display_name  = coalesce($3, display_name),
       institution   = coalesce($4, institution),
       masked_number = coalesce($5, masked_number),
       credit_limit  = coalesce($6, credit_limit),
       goal_domain   = coalesce($7, goal_domain),
       status        = coalesce($8, status),
       last_synced_at= coalesce($9, last_synced_at),
       updated_at    = now()
     where id = $1 and profile_key = $2
     returning *`,
    [
      id,
      profileKey,
      patch.displayName ?? null,
      patch.institution ?? null,
      patch.maskedNumber ?? null,
      patch.creditLimit ?? null,
      patch.goalDomain ?? null,
      patch.status ?? null,
      patch.lastSyncedAt ?? null,
    ],
  );
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function closeBankAccount(profileKey, id) {
  const res = await query(
    `update bank_accounts set status = 'closed', updated_at = now() where id = $1 and profile_key = $2 returning id`,
    [id, profileKey],
  );
  return res.rows.length > 0;
}
