"use client";

// CSV transaction import (Usable RC, section 六). Upload -> validate ->
// map columns -> preview (with duplicate + invalid-row report) -> confirm
// -> atomic import -> receipt. A committed batch can be rolled back. The
// same file cannot be imported twice.

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./bank.module.css";
import { LoadingState, ErrorState } from "./AsyncState.jsx";

const COLS = ["date", "description", "merchant", "debit", "credit", "amount", "currency", "reference", "status"];
const MAX_BYTES = 2 * 1024 * 1024;

export function CsvImportWizard({ onDone }) {
  const [accounts, setAccounts] = useState({ status: "loading", list: [] });
  const [accountId, setAccountId] = useState("");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const loadAccounts = useCallback(async () => {
    try {
      const [aRes, bRes] = await Promise.all([fetch("/api/bank/accounts"), fetch("/api/import/transactions")]);
      const a = aRes.ok ? await aRes.json() : { accounts: [] };
      const b = bRes.ok ? await bRes.json() : { batches: [] };
      setAccounts({ status: "ready", list: a.accounts ?? [] });
      setBatches(b.batches ?? []);
      if (!accountId && a.accounts?.[0]) setAccountId(a.accounts[0].id);
    } catch {
      setAccounts({ status: "error", list: [] });
    }
  }, [accountId]);
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) return setError("File is larger than 2 MB.");
    if (!/\.csv$/i.test(f.name) && f.type && !/text|csv/i.test(f.type)) return setError("Please choose a .csv file.");
    setError("");
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f);
  };

  const doPreview = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/import/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preview", accountId, fileName, csv }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Preview failed.");
      setPreview(data);
      setMapping(data.mapping);
    } finally {
      setBusy(false);
    }
  };

  const doCommit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/import/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "commit", accountId, fileName, csv, mapping }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Import failed.");
      setReceipt(data);
      loadAccounts();
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (batchId) => {
    if (!window.confirm("Remove every transaction from this import?")) return;
    await fetch("/api/import/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rollback", batchId }) });
    loadAccounts();
  };

  if (accounts.status === "loading") return <LoadingState label="Loading accounts…" />;
  if (accounts.status === "error") return <ErrorState onRetry={loadAccounts} />;

  return (
    <div className={`${styles.bank} ${styles.wizard}`} aria-label="Import transactions from CSV">
      <div className={styles.rowActions}>
        <button type="button" className={styles.ghostBtn} onClick={() => onDone?.()}>
          Done
        </button>
      </div>

      {accounts.list.length === 0 ? (
        <p className={styles.fieldError}>Add an account first, then import into it.</p>
      ) : (
        <>
          <label className={styles.field}>
            <span>Import into account</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName || a.kind} ({a.currency})
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>CSV file (.csv, max 2 MB) — parsed on the server, never executed</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} />
          </label>
          {fileName ? <p className={styles.provenance}>{fileName} loaded ({csv.length.toLocaleString()} chars)</p> : null}

          <button type="button" className={styles.primaryBtn} disabled={busy || !csv || !accountId} onClick={doPreview}>
            Preview
          </button>
        </>
      )}

      {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}

      {preview ? (
        <section aria-labelledby="csv-preview">
          <h3 id="csv-preview" className={styles.gSectionTitle}>Preview</h3>
          <div className={styles.field}>
            <span>Column mapping (adjust if wrong)</span>
            {COLS.map((c) => (
              <label key={c} className={styles.field} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <span style={{ width: 90 }}>{c}</span>
                <select
                  value={mapping?.[c] ?? -1}
                  onChange={(e) => setMapping((m) => ({ ...m, [c]: Number(e.target.value) }))}
                >
                  <option value={-1}>— none —</option>
                  {(preview.header ?? []).map((h, i) => (
                    <option key={i} value={i}>
                      {h || `column ${i}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={doPreview}>
              Re-preview with this mapping
            </button>
          </div>

          <ul className={styles.gList}>
            <li>{preview.rowCount} data rows</li>
            <li>{preview.toImport} to import</li>
            <li>{preview.duplicates} duplicates (skipped)</li>
            <li>{preview.invalidRows?.length ?? 0} invalid rows</li>
          </ul>
          {preview.invalidRows?.length ? (
            <details>
              <summary>Invalid rows</summary>
              <ul className={styles.gList}>
                {preview.invalidRows.map((r, i) => (
                  <li key={i}>Row {r.row}: {r.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {preview.sample?.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Dir</th>
                    <th>Amount</th>
                    <th>Ccy</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((s, i) => (
                    <tr key={i}>
                      <td>{s.date}</td>
                      <td>{s.merchant}</td>
                      <td>{s.direction}</td>
                      <td>{s.amount}</td>
                      <td>{s.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <button type="button" className={styles.primaryBtn} disabled={busy || !preview.toImport} onClick={doCommit}>
            Import {preview.toImport} transaction{preview.toImport === 1 ? "" : "s"}
          </button>
        </section>
      ) : null}

      {receipt ? (
        <section className={styles.gSection} role="status">
          <p className={styles.gSectionTitle}>Import receipt</p>
          <ul className={styles.gList}>
            <li>Status: {receipt.status}</li>
            <li>Imported: {receipt.imported ?? receipt.receipt?.imported ?? 0}</li>
            <li>Skipped duplicates: {receipt.skippedDuplicates ?? 0}</li>
            <li>Invalid rows: {receipt.invalidRows?.length ?? 0}</li>
          </ul>
          {receipt.batchId ? (
            <button type="button" className={styles.dangerBtn} onClick={() => rollback(receipt.batchId)}>
              Roll back this import
            </button>
          ) : null}
        </section>
      ) : null}

      {batches.length ? (
        <section className={styles.gSection}>
          <p className={styles.gSectionTitle}>Past imports</p>
          <ul className={styles.txnList}>
            {batches.map((b) => (
              <li key={b.id} className={styles.txnRow}>
                <span>
                  <span className={styles.txnMerchant}>{b.fileName}</span>
                  <span className={styles.txnMeta}> {b.importedCount} imported · {b.status}</span>
                </span>
                {b.status === "committed" ? (
                  <button type="button" className={styles.pill} onClick={() => rollback(b.id)}>
                    Roll back
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
