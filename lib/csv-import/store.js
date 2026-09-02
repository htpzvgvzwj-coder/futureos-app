// CSV import - atomic commit + rollback + idempotency (Usable RC, §六).
// A previewed batch is committed in ONE transaction; the same file (by
// sha256) can never be committed twice; a committed batch can be rolled
// back, removing exactly the rows it added.

import crypto from "node:crypto";
import { query, withTransaction } from "../db.js";
import { recordAuditEvent } from "../account-control/store.js";

export function fileHash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export async function existingFingerprints(profileKey, accountId) {
  // Rebuild the same fingerprint the parser produces, from stored rows.
  const res = await query(
    `select to_char(coalesce(posted_at, authorised_at, created_at), 'YYYY-MM-DD') as d,
            direction, amount, currency, coalesce(merchant, reference, '') as m
     from bank_transactions where profile_key = $1 and account_id = $2`,
    [profileKey, accountId],
  );
  const set = new Set();
  for (const r of res.rows) {
    set.add(`${r.d}|${r.direction}|${Number(r.amount)}|${String(r.currency).toUpperCase()}|${String(r.m).toLowerCase().slice(0, 40)}`);
  }
  return set;
}

export async function createPreviewBatch(profileKey, { accountId, fileName, hash, rowCount, mapping }) {
  const res = await query(
    `insert into import_batches (profile_key, account_id, file_name, file_hash, row_count, mapping, status)
     values ($1,$2,$3,$4,$5,$6::jsonb,'previewed') returning *`,
    [profileKey, accountId, fileName ?? "", hash, rowCount ?? 0, JSON.stringify(mapping ?? {})],
  );
  return mapRow(res.rows[0]);
}

// Commit a set of already-normalised, already-deduped transactions against
// one batch, atomically. Refuses if the file hash was committed before.
export async function commitBatch(profileKey, { hash, accountId, fileName, mapping, transactions, skipped = 0 }) {
  const dupe = await query(
    `select id from import_batches where profile_key = $1 and file_hash = $2 and status = 'committed'`,
    [profileKey, hash],
  );
  if (dupe.rows[0]) {
    return { idempotent: true, batchId: dupe.rows[0].id, imported: 0, skipped: transactions.length };
  }

  return withTransaction(async (tx) => {
    const acc = await tx.query(`select id, kind from bank_accounts where id = $1 and profile_key = $2 for update`, [accountId, profileKey]);
    if (!acc.rows[0]) throw new Error("account not found for this user");
    const kind = acc.rows[0].kind;

    const b = await tx.query(
      `insert into import_batches (profile_key, account_id, file_name, file_hash, row_count, imported_count, skipped_count, mapping, status, committed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'committed', now()) returning id`,
      [profileKey, accountId, fileName ?? "", hash, transactions.length + skipped, transactions.length, skipped, JSON.stringify(mapping ?? {})],
    );
    const batchId = b.rows[0].id;

    for (const t of transactions) {
      await tx.query(
        `insert into bank_transactions
           (profile_key, account_id, direction, amount, currency, status, merchant, reference, category, channel,
            source_type, authorised_at, posted_at, import_batch_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'import','synthetic_fixture',$10,$10,$11)`,
        [
          profileKey, accountId, t.direction, t.amount, t.currency,
          t.status ?? "posted", t.merchant ?? null, t.reference ?? null, t.category ?? null,
          t.date, batchId,
        ],
      );
    }
    await recordAuditEvent(tx, profileKey, { kind: "import_committed", detail: { batchId, imported: transactions.length, skipped, accountId, kind } });
    return { idempotent: false, batchId, imported: transactions.length, skipped };
  });
}

export async function rollbackBatch(profileKey, batchId) {
  return withTransaction(async (tx) => {
    const b = await tx.query(`select id, status from import_batches where id = $1 and profile_key = $2 for update`, [batchId, profileKey]);
    if (!b.rows[0]) throw new Error("import batch not found");
    if (b.rows[0].status !== "committed") throw new Error(`batch is ${b.rows[0].status}, cannot roll back`);
    const del = await tx.query(`delete from bank_transactions where import_batch_id = $1 and profile_key = $2 returning id`, [batchId, profileKey]);
    await tx.query(`update import_batches set status = 'rolled_back', rolled_back_at = now() where id = $1`, [batchId]);
    await recordAuditEvent(tx, profileKey, { kind: "import_rolled_back", detail: { batchId, removed: del.rows.length } });
    return { removed: del.rows.length };
  });
}

export async function listBatches(profileKey) {
  const res = await query(`select * from import_batches where profile_key = $1 order by created_at desc limit 50`, [profileKey]);
  return res.rows.map(mapRow);
}

function mapRow(r) {
  return {
    id: r.id,
    accountId: r.account_id,
    fileName: r.file_name,
    fileHash: r.file_hash,
    rowCount: r.row_count,
    importedCount: r.imported_count,
    skippedCount: r.skipped_count,
    status: r.status,
    mapping: r.mapping ?? {},
    createdAt: r.created_at,
    committedAt: r.committed_at,
    rolledBackAt: r.rolled_back_at,
  };
}
