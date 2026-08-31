"use client";

// Account control (Usable RC, section 十三 / 十六). Consent management,
// data export, account deletion, the audit trail, and shared-access
// roles - all reading /api/account and /api/onboarding.

import { useCallback, useEffect, useState } from "react";
import styles from "./bank.module.css";
import { LoadingState, ErrorState } from "./AsyncState.jsx";

const ROLES = ["guardian", "dependent", "household_member", "trusted_contact", "beneficiary_placeholder"];
const SCOPES = ["view", "contribute", "suggest", "approve", "manage", "revoke"];

export function AccountControl({ onDone }) {
  const [data, setData] = useState({ status: "loading", consent: [], audit: [], roles: [] });
  const [msg, setMsg] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(async () => {
    setData((d) => ({ ...d, status: "loading" }));
    try {
      const [c, a, r] = await Promise.all([
        fetch("/api/account?view=consent"),
        fetch("/api/account?view=audit"),
        fetch("/api/account?view=roles"),
      ]);
      if (!c.ok) return setData((d) => ({ ...d, status: "error" }));
      setData({
        status: "ready",
        consent: (await c.json()).consent ?? [],
        audit: a.ok ? (await a.json()).events ?? [] : [],
        roles: r.ok ? (await r.json()).roles ?? [] : [],
      });
    } catch {
      setData((d) => ({ ...d, status: "error" }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const revokeConsent = async (scope) => {
    const res = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke_consent", scope }) });
    setMsg(res.ok ? `Revoked ${scope}.` : "Could not revoke.");
    load();
  };

  const exportData = () => {
    // A GET with content-disposition: attachment - the browser downloads it.
    window.location.href = "/api/account?view=export";
  };

  const deleteAccount = async () => {
    const res = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", confirm: confirmText }) });
    const body = await res.json();
    if (res.ok) {
      setMsg("Account deleted. Signing you out…");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } else {
      setMsg(body.message ?? "Type DELETE to confirm.");
    }
  };

  const grantRole = async (role, scope) => {
    await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "grant_role", role, scope }) });
    load();
  };
  const revokeRole = async (roleId) => {
    await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke_role", roleId }) });
    load();
  };

  if (data.status === "loading") return <LoadingState label="Loading your controls…" />;
  if (data.status === "error") return <ErrorState onRetry={load} />;

  return (
    <div className={`${styles.bank} ${styles.wizard}`} aria-label="Account and privacy controls">
      <div className={styles.rowActions}>
        <button type="button" className={styles.ghostBtn} onClick={() => onDone?.()}>
          Done
        </button>
      </div>
      {msg ? <p className={styles.provenance} role="status">{msg}</p> : null}

      <section className={styles.gSection} aria-labelledby="ac-consent">
        <h3 id="ac-consent" className={styles.gSectionTitle}>Consent</h3>
        {data.consent.map((c) => (
          <div key={c.scope} className={styles.consentRow}>
            <span style={{ flex: 1 }}>
              <strong>{c.scope.replace(/_/g, " ")}</strong> — {c.granted ? "granted" : "not granted"}
              {c.required ? <span className={styles.consentReq}>required</span> : null}
            </span>
            {c.granted && !c.required ? (
              <button type="button" className={styles.pill} onClick={() => revokeConsent(c.scope)}>
                Revoke
              </button>
            ) : null}
          </div>
        ))}
      </section>

      <section className={styles.gSection} aria-labelledby="ac-shared">
        <h3 id="ac-shared" className={styles.gSectionTitle}>Shared access</h3>
        {data.roles.length === 0 ? <p className={styles.provenance}>No one else has access.</p> : null}
        <ul className={styles.txnList}>
          {data.roles.map((r) => (
            <li key={r.id} className={styles.txnRow}>
              <span>
                <span className={styles.txnMerchant}>{r.role.replace(/_/g, " ")}</span>
                <span className={styles.txnMeta}> {r.scope} · {r.status}{r.legalConfirmationRequired ? " · needs legal confirmation" : ""}</span>
              </span>
              <button type="button" className={styles.pill} onClick={() => revokeRole(r.id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
        <RoleGrant onGrant={grantRole} />
      </section>

      <section className={styles.gSection} aria-labelledby="ac-export">
        <h3 id="ac-export" className={styles.gSectionTitle}>Your data</h3>
        <div className={styles.rowActions}>
          <button type="button" className={styles.primaryBtn} onClick={exportData}>
            Export my data (JSON)
          </button>
        </div>
      </section>

      <section className={styles.gSection} aria-labelledby="ac-delete">
        <h3 id="ac-delete" className={styles.gSectionTitle}>Delete my account</h3>
        <p className={styles.provenance}>
          This removes your accounts, transactions, plans, Financial Twin and shared access. Active sessions end and login stops working.
          Any outward sharing or legal retention is flagged for compliance review.
        </p>
        <label className={styles.field}>
          <span>Type DELETE to confirm</span>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </label>
        <button type="button" className={styles.dangerBtn} disabled={confirmText !== "DELETE"} onClick={deleteAccount}>
          Permanently delete my account
        </button>
      </section>

      <section className={styles.gSection} aria-labelledby="ac-audit">
        <h3 id="ac-audit" className={styles.gSectionTitle}>Recent account activity</h3>
        <ul className={styles.txnList}>
          {data.audit.slice(0, 15).map((e) => (
            <li key={e.id} className={styles.txnRow}>
              <span>
                <span className={styles.txnMerchant}>{e.kind.replace(/_/g, " ")}</span>
              </span>
              <span className={styles.txnMeta}>{new Date(e.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RoleGrant({ onGrant }) {
  const [role, setRole] = useState(ROLES[0]);
  const [scope, setScope] = useState("view");
  return (
    <form
      className={styles.rowActions}
      onSubmit={(e) => {
        e.preventDefault();
        onGrant(role, scope);
      }}
      style={{ marginTop: 8 }}
    >
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select value={scope} onChange={(e) => setScope(e.target.value)}>
        {SCOPES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="submit" className={styles.ghostBtn}>
        Add role
      </button>
    </form>
  );
}
