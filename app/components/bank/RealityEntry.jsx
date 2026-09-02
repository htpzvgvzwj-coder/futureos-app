"use client";

// Manual reality entry (Usable RC, section 五). Add / edit accounts,
// assets, liabilities, income and recurring bills. Every amount carries
// currency + as-of; deletes that a plan depends on are not silent.

import { useCallback, useEffect, useState } from "react";
import styles from "./bank.module.css";
import { LoadingState, ErrorState, EmptyState } from "./AsyncState.jsx";

const ACCOUNT_KINDS = ["current", "savings", "fixed_deposit", "credit_card", "multi_currency", "goal_wallet"];
const ASSET_CLASSES = ["bank_account", "fixed_deposit", "foreign_currency", "investment", "cpf_oa", "cpf_sa_ra", "medisave", "property", "business_equity", "insurance_cash_value", "receivable"];
const LIABILITY_CLASSES = ["credit_card_statement", "credit_card_revolving", "mortgage", "hdb_loan", "education_loan", "car_loan", "personal_loan", "bnpl", "tax_payable", "other_obligation"];
const LIQUIDITY = ["cash", "near_cash", "liquid", "restricted", "illiquid"];

function Field({ label, children, error }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {error ? <span className={styles.fieldError}>{error}</span> : null}
    </label>
  );
}

export function RealityEntry({ onDone, onOpen }) {
  const [state, setState] = useState({ status: "loading", accounts: [], assets: [], liabilities: [], income: [], recurring: [] });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const [aRes, rRes] = await Promise.all([
        fetch("/api/bank/accounts", { headers: { "cache-control": "no-cache" } }),
        fetch("/api/financial-twin/rows", { headers: { "cache-control": "no-cache" } }),
      ]);
      if (!aRes.ok || !rRes.ok) return setState((s) => ({ ...s, status: "error" }));
      const a = await aRes.json();
      const r = await rRes.json();
      setState({ status: "ready", accounts: a.accounts ?? [], assets: r.assets ?? [], liabilities: r.liabilities ?? [], income: r.income ?? [], recurring: r.recurring ?? [] });
    } catch {
      setState((s) => ({ ...s, status: "error" }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const addAccount = async (form) => {
    const res = await fetch("/api/bank/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setMsg("Account added.");
      load();
    } else setMsg((await res.json()).error ?? "Could not add account.");
  };
  const addRow = async (kind, data) => {
    const res = await fetch("/api/financial-twin/rows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, data }) });
    if (res.ok) {
      setMsg("Saved.");
      load();
    } else setMsg((await res.json()).error ?? "Could not save.");
  };
  const delRow = async (kind, id) => {
    let res = await fetch(`/api/financial-twin/rows?kind=${kind}&id=${id}`, { method: "DELETE" });
    if (res.status === 409) {
      const info = await res.json();
      if (!window.confirm(`This is used by: ${info.usedByPlans.join(", ")}. Delete anyway?`)) return;
      res = await fetch(`/api/financial-twin/rows?kind=${kind}&id=${id}&confirm=true`, { method: "DELETE" });
    }
    if (res.ok) {
      setMsg("Removed.");
      load();
    }
  };

  if (state.status === "loading") return <LoadingState label="Loading your data…" />;
  if (state.status === "error") return <ErrorState onRetry={load} message="Your data could not load." />;

  const totalItems = state.accounts.length + state.assets.length + state.liabilities.length + state.income.length + state.recurring.length;

  return (
    <div className={`${styles.bank} ${styles.wizard}`} aria-label="Add or edit your financial reality">
      <div className={styles.rowActions}>
        <button type="button" className={styles.ghostBtn} onClick={() => onDone?.()}>
          Done
        </button>
        <button type="button" className={styles.ghostBtn} onClick={() => onOpen?.("csvImport")}>
          Import CSV instead
        </button>
      </div>
      {msg ? <p className={styles.provenance} role="status">{msg}</p> : null}
      {totalItems === 0 ? <EmptyState title="Nothing added yet" hint="Start with a current account and your income." /> : null}

      <MiniForm
        title="Add an account"
        fields={[
          { name: "kind", label: "Type", type: "select", options: ACCOUNT_KINDS, required: true },
          { name: "displayName", label: "Name", type: "text" },
          { name: "institution", label: "Bank", type: "text" },
          { name: "currency", label: "Currency", type: "text", default: "SGD" },
        ]}
        onSubmit={addAccount}
      />
      <RowList title="Accounts" rows={state.accounts.map((a) => ({ id: a.id, label: `${a.displayName || a.kind} · ${a.currency}`, sub: a.institution ?? "" }))} />

      <MiniForm
        title="Add an asset"
        fields={[
          { name: "assetClass", label: "Class", type: "select", options: ASSET_CLASSES, required: true },
          { name: "label", label: "Label", type: "text" },
          { name: "currentValue", label: "Value", type: "number", required: true },
          { name: "liquidityClass", label: "Liquidity", type: "select", options: LIQUIDITY, default: "liquid" },
          { name: "restrictedPurpose", label: "Earmarked for (optional)", type: "text" },
          { name: "ownershipPercent", label: "Your %", type: "number", default: "100" },
        ]}
        onSubmit={(d) => addRow("asset", d)}
      />
      <RowList title="Assets" rows={state.assets.map((a) => ({ id: a.id, label: `${a.label || a.assetClass}: ${a.currency} ${a.currentValue}`, sub: `${a.liquidityClass}${a.restrictedPurpose ? ` · ${a.restrictedPurpose}` : ""} · ${a.ownershipPercent}%` }))} onDelete={(id) => delRow("asset", id)} />

      <MiniForm
        title="Add a liability"
        fields={[
          { name: "liabilityClass", label: "Class", type: "select", options: LIABILITY_CLASSES, required: true },
          { name: "label", label: "Label", type: "text" },
          { name: "currentBalance", label: "Balance owed", type: "number", required: true },
          { name: "minimumMonthly", label: "Min monthly", type: "number" },
          { name: "apr", label: "APR %", type: "number" },
        ]}
        onSubmit={(d) => addRow("liability", d)}
      />
      <RowList title="Liabilities" rows={state.liabilities.map((l) => ({ id: l.id, label: `${l.label || l.liabilityClass}: ${l.currency} ${l.currentBalance}`, sub: l.minimumMonthly ? `min ${l.minimumMonthly}/mo` : "" }))} onDelete={(id) => delRow("liability", id)} />

      <MiniForm
        title="Add income"
        fields={[
          { name: "label", label: "Name", type: "text" },
          { name: "kind", label: "Kind", type: "select", options: ["salary", "rental", "dividend", "freelance", "other"], default: "salary" },
          { name: "monthlyAmount", label: "Monthly amount", type: "number", required: true },
          { name: "payDayOfMonth", label: "Pay day", type: "number" },
          { name: "nextExpectedDate", label: "Next expected (YYYY-MM-DD)", type: "text" },
        ]}
        onSubmit={(d) => addRow("income", d)}
      />
      <RowList title="Income" rows={state.income.map((i) => ({ id: i.id, label: `${i.label || i.kind}: ${i.currency} ${i.monthlyAmount}/mo`, sub: i.nextExpectedDate ? `next ${i.nextExpectedDate}` : "" }))} onDelete={(id) => delRow("income", id)} />

      <MiniForm
        title="Add a recurring bill / subscription"
        fields={[
          { name: "label", label: "Name", type: "text", required: true },
          { name: "merchant", label: "Merchant", type: "text" },
          { name: "monthlyAmount", label: "Monthly amount", type: "number", required: true },
          { name: "nextDueDate", label: "Next due (YYYY-MM-DD)", type: "text" },
        ]}
        onSubmit={(d) => addRow("recurring", { ...d, recurringGroup: `${(d.label || "bill").toLowerCase().replace(/\s+/g, "-")}` })}
      />
      <RowList title="Recurring" rows={state.recurring.map((r) => ({ id: r.id, label: `${r.label}: ${r.currency} ${r.monthlyAmount}/mo`, sub: r.nextDueDate ? `next ${r.nextDueDate}` : "" }))} onDelete={(id) => delRow("recurring", id)} />
    </div>
  );
}

function MiniForm({ title, fields, onSubmit }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === "select" ? f.options[0] : "")])));
  const [errors, setErrors] = useState({});
  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    for (const f of fields) {
      if (f.required && !String(values[f.name] ?? "").trim()) errs[f.name] = "Required";
      if (f.type === "number" && values[f.name] !== "" && !Number.isFinite(Number(values[f.name]))) errs[f.name] = "Must be a number";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(values);
    setValues((v) => ({ ...v, label: "", displayName: "", currentValue: "", currentBalance: "", monthlyAmount: "" }));
  };
  return (
    <form onSubmit={submit} className={styles.gSection} aria-label={title}>
      <p className={styles.gSectionTitle}>{title}</p>
      {fields.map((f) => (
        <Field key={f.name} label={f.label} error={errors[f.name]}>
          {f.type === "select" ? (
            <select value={values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              aria-invalid={Boolean(errors[f.name])}
            />
          )}
        </Field>
      ))}
      <button type="submit" className={styles.primaryBtn}>
        Add
      </button>
    </form>
  );
}

function RowList({ title, rows, onDelete }) {
  if (!rows.length) return null;
  return (
    <div className={styles.gSection}>
      <p className={styles.gSectionTitle}>{title}</p>
      <ul className={styles.txnList}>
        {rows.map((r) => (
          <li key={r.id} className={styles.txnRow}>
            <span>
              <span className={styles.txnMerchant}>{r.label}</span>
              {r.sub ? <span className={styles.txnMeta}> {r.sub}</span> : null}
            </span>
            {onDelete ? (
              <button type="button" className={styles.pill} onClick={() => onDelete(r.id)}>
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
