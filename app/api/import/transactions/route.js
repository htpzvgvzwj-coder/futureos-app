import { getCurrentUserId } from "../../../../lib/auth.js";
import { parseCsv, guessMapping, normaliseRows, splitDuplicates } from "../../../../lib/csv-import/parse.js";
import { fileHash, existingFingerprints, commitBatch, rollbackBatch, listBatches } from "../../../../lib/csv-import/store.js";
import { guard } from "../../../../lib/http-guards.js";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// POST /api/import/transactions
//   { action: "preview", accountId, fileName, csv }          -> parsed preview + duplicates + errors
//   { action: "commit",  accountId, fileName, csv, mapping }  -> atomic import (idempotent by file hash)
//   { action: "rollback", batchId }                           -> remove exactly that batch's rows
// GET -> the user's import history.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ batches: await listBatches(userId) });
}

export async function POST(request) {
  const blocked = guard(request, { bucket: "import", limit: 12, windowMs: 60_000 });
  if (blocked) return blocked;
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "rollback") {
      if (!body.batchId) return Response.json({ error: "batchId_required" }, { status: 400 });
      return Response.json(await rollbackBatch(userId, body.batchId));
    }

    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv) return Response.json({ error: "csv_required" }, { status: 400 });
    if (Buffer.byteLength(csv, "utf8") > MAX_BYTES) return Response.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
    if (!body.accountId) return Response.json({ error: "accountId_required" }, { status: 400 });

    const grid = parseCsv(csv);
    if (grid.length < 2) return Response.json({ error: "no_data_rows" }, { status: 400 });
    const mapping = body.mapping && Object.keys(body.mapping).length ? body.mapping : guessMapping(grid[0]);
    const { transactions, errors, rowCount } = normaliseRows(grid, mapping);
    const existing = await existingFingerprints(userId, body.accountId);
    const { fresh, duplicates } = splitDuplicates(transactions, existing);
    const hash = fileHash(csv);

    if (body.action === "preview") {
      return Response.json({
        status: "previewed",
        header: grid[0],
        mapping,
        rowCount,
        parsed: transactions.length,
        toImport: fresh.length,
        duplicates: duplicates.length,
        invalidRows: errors,
        sample: fresh.slice(0, 8),
        fileHash: hash,
      });
    }

    if (body.action === "commit") {
      const result = await commitBatch(userId, {
        hash, accountId: body.accountId, fileName: body.fileName ?? "import.csv", mapping,
        transactions: fresh, skipped: duplicates.length,
      });
      return Response.json({
        status: result.idempotent ? "already_imported" : "committed",
        batchId: result.batchId,
        imported: result.imported,
        skippedDuplicates: result.skipped,
        invalidRows: errors,
        receipt: { rowCount, imported: result.imported, skipped: result.skipped, invalid: errors.length, fileHash: hash },
      });
    }

    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
