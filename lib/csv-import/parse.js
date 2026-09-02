// CSV transaction import - parsing + normalisation (Usable RC, section 六).
// Pure: takes raw text, returns structured rows + per-row errors. The route
// handles upload limits, the store handles atomic commit + idempotency.
//
// No eval, no Function, no external parser. A small RFC-4180-ish reader
// that handles quoted fields, embedded commas and CRLF.

export const KNOWN_COLUMNS = ["date", "description", "merchant", "debit", "credit", "amount", "currency", "balance", "reference", "status"];
export const MAX_ROWS = 20000;

export function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  const src = String(text ?? "").replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

// Guess a column mapping from the header row.
export function guessMapping(header = []) {
  const norm = header.map((h) => String(h).trim().toLowerCase().replace(/[\s_-]+/g, ""));
  const find = (...names) => {
    for (const n of names) {
      const idx = norm.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    date: find("date", "transactiondate", "valuedate", "posteddate", "bookingdate"),
    description: find("description", "details", "narrative", "particulars", "memo"),
    merchant: find("merchant", "payee", "counterparty", "name"),
    debit: find("debit", "withdrawal", "moneyout", "paidout", "outflow"),
    credit: find("credit", "deposit", "moneyin", "paidin", "inflow"),
    amount: find("amount", "value", "transactionamount"),
    currency: find("currency", "ccy"),
    balance: find("balance", "runningbalance", "ledgerbalance"),
    reference: find("reference", "ref", "transactionref", "chequeno"),
    status: find("status", "state"),
  };
}

function toNumber(v) {
  if (v == null) return null;
  const s = String(v).replace(/[,\s]/g, "").replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  // ISO
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy or dd-mm-yyyy
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (m) {
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Turn parsed grid + a mapping into normalised transaction candidates,
// reporting every invalid row rather than aborting.
export function normaliseRows(grid, mapping, { defaultCurrency = "SGD" } = {}) {
  if (!Array.isArray(grid) || grid.length < 2) return { transactions: [], errors: [{ row: 0, message: "no data rows" }], rowCount: 0 };
  const dataRows = grid.slice(1);
  if (dataRows.length > MAX_ROWS) return { transactions: [], errors: [{ row: 0, message: `too many rows (max ${MAX_ROWS})` }], rowCount: dataRows.length };

  const at = (cells, idx) => (idx != null && idx >= 0 && idx < cells.length ? String(cells[idx]).trim() : "");
  const transactions = [];
  const errors = [];

  dataRows.forEach((cells, i) => {
    const line = i + 2; // 1-based, plus header
    const date = toIsoDate(at(cells, mapping.date));
    if (!date) {
      errors.push({ row: line, message: "missing or unparseable date" });
      return;
    }
    let amount = null;
    let direction = null;
    const debit = toNumber(at(cells, mapping.debit));
    const credit = toNumber(at(cells, mapping.credit));
    const single = toNumber(at(cells, mapping.amount));
    if (debit != null && debit !== 0) {
      amount = Math.abs(debit);
      direction = "debit";
    } else if (credit != null && credit !== 0) {
      amount = Math.abs(credit);
      direction = "credit";
    } else if (single != null && single !== 0) {
      amount = Math.abs(single);
      direction = single < 0 ? "debit" : "credit";
    } else {
      errors.push({ row: line, message: "no debit / credit / amount" });
      return;
    }
    const description = at(cells, mapping.description);
    const merchant = at(cells, mapping.merchant) || description.slice(0, 64) || null;
    const currency = (at(cells, mapping.currency) || defaultCurrency).toUpperCase().slice(0, 3);
    const reference = at(cells, mapping.reference) || null;
    const statusRaw = at(cells, mapping.status).toLowerCase();
    const status = ["pending", "posted", "failed", "reversed"].includes(statusRaw) ? statusRaw : "posted";

    transactions.push({
      date,
      direction,
      amount: Math.round(amount * 100) / 100,
      currency,
      merchant,
      description: description || null,
      reference,
      status,
      // a per-row fingerprint for duplicate detection within + across imports
      fingerprint: `${date}|${direction}|${amount}|${currency}|${(merchant || description || "").toLowerCase().slice(0, 40)}`,
    });
  });

  return { transactions, errors, rowCount: dataRows.length };
}

// Duplicate detection against an existing set of fingerprints.
export function splitDuplicates(candidates, existingFingerprints = new Set()) {
  const seen = new Set(existingFingerprints);
  const fresh = [];
  const duplicates = [];
  for (const c of candidates) {
    if (seen.has(c.fingerprint)) duplicates.push(c);
    else {
      seen.add(c.fingerprint);
      fresh.push(c);
    }
  }
  return { fresh, duplicates };
}
