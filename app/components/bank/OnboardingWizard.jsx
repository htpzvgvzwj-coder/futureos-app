"use client";

// First-run onboarding (Usable RC, section 四). Progressive: account type
// -> consent grid -> add reality -> first useful result. A brand-new user
// sees this instead of Today until it is complete. No preset persona is
// ever loaded.

import { useCallback, useEffect, useState } from "react";
import styles from "./bank.module.css";
import { LoadingState, ErrorState } from "./AsyncState.jsx";

const ACCOUNT_TYPES = [
  { id: "individual", name: "Individual adult", hint: "Just me, managing my own money." },
  { id: "youth", name: "Youth with a guardian", hint: "I'm under the local age limit; a guardian approves key actions." },
  { id: "guardian_managed_child", name: "Parent / guardian managing a child profile", hint: "I manage money and permissions for a child." },
  { id: "household", name: "Household / shared planning", hint: "We plan together and share some visibility." },
];

const CONSENT_COPY = {
  account_data: { why: "To show your real balances and Available to Spend.", affects: "Today, Life, Safe-to-Spend." },
  transaction_data: { why: "To categorise spending and find recurring bills.", affects: "Transactions, Spending, Money Rescue." },
  assets_liabilities: { why: "To compute net worth and what a plan really costs.", affects: "Financial Twin, every Studio." },
  planning_data: { why: "To keep your plans and their history.", affects: "Studios, Mirror, History." },
  shared_data: { why: "To let people you invite see agreed bands (never private amounts).", affects: "Shared Money, Family." },
  guardian_monitoring: { why: "To let Guardian watch reality against your sealed plans.", affects: "Guardian alerts and check-ins." },
};

export function OnboardingWizard({ onComplete, onOpen }) {
  const [state, setState] = useState({ status: "loading", onboarding: null, consent: [] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const res = await fetch("/api/onboarding", { headers: { "cache-control": "no-cache" } });
      if (!res.ok) return setState({ status: "error", onboarding: null, consent: [] });
      const data = await res.json();
      setState({ status: "ready", onboarding: data.onboarding, consent: data.consent });
    } catch {
      setState({ status: "error", onboarding: null, consent: [] });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const post = async (body) => {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        if (data.onboarding) setState((s) => ({ ...s, onboarding: data.onboarding }));
        if (data.consent) setState((s) => ({ ...s, consent: data.consent }));
      }
      return { ok: res.ok, data };
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "loading") return <LoadingState label="Setting up FutureOS…" />;
  if (state.status === "error") return <ErrorState onRetry={load} message="Onboarding could not load." />;

  const step = state.onboarding?.step ?? "account_type";
  const stepIndex = ["account_type", "consent", "add_reality", "first_result", "complete"].indexOf(step);
  const requiredConsent = state.consent.filter((c) => c.required);
  const requiredGranted = requiredConsent.every((c) => c.granted);

  return (
    <div className={`${styles.bank} ${styles.wizard}`} aria-label="Set up FutureOS">
      <ol className={styles.wizardSteps}>
        {["Account", "Consent", "Add reality", "First result"].map((label, i) => (
          <li key={label} className={`${styles.wizardStep} ${i === stepIndex ? styles.wizardStepActive : ""} ${i < stepIndex ? styles.wizardStepDone : ""}`}>
            {label}
          </li>
        ))}
      </ol>

      {step === "account_type" ? (
        <section aria-labelledby="ob-type">
          <h2 id="ob-type" className={styles.gSectionTitle}>What kind of account is this?</h2>
          <p className={styles.provenance}>You will not be able to bypass age, guardian or financial-product limits that apply locally.</p>
          <div className={styles.choiceList}>
            {ACCOUNT_TYPES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={styles.choiceBtn}
                aria-pressed={state.onboarding?.accountType === a.id}
                disabled={busy}
                onClick={() => post({ action: "set_account_type", accountType: a.id })}
              >
                <span className={styles.choiceName}>{a.name}</span>
                <span className={styles.choiceHint}>{a.hint}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "consent" ? (
        <section aria-labelledby="ob-consent">
          <h2 id="ob-consent" className={styles.gSectionTitle}>What may FutureOS use?</h2>
          {state.consent.map((c) => (
            <div key={c.scope} className={styles.consentRow}>
              <input
                id={`consent-${c.scope}`}
                type="checkbox"
                checked={c.granted}
                onChange={(e) => {
                  const granted = e.target.checked;
                  // optimistic: flip locally now, reconcile from the server response
                  setState((s) => ({ ...s, consent: s.consent.map((x) => (x.scope === c.scope ? { ...x, granted } : x)) }));
                  post({ action: "set_consent", scope: c.scope, granted });
                }}
              />
              <label htmlFor={`consent-${c.scope}`}>
                <strong>{c.scope.replace(/_/g, " ")}</strong>
                {c.required ? <span className={styles.consentReq}>required</span> : null}
                <br />
                <span className={styles.choiceHint}>
                  {CONSENT_COPY[c.scope]?.why} Affects: {CONSENT_COPY[c.scope]?.affects} You can revoke this later in Account.
                </span>
              </label>
            </div>
          ))}
          <div className={styles.rowActions} style={{ marginTop: 12 }}>
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => post({ action: "advance", step: "account_type" })}>
              Back
            </button>
            <button type="button" className={styles.primaryBtn} disabled={busy || !requiredGranted} onClick={() => post({ action: "advance", step: "add_reality" })}>
              Continue
            </button>
          </div>
          {!requiredGranted ? <p className={styles.fieldError}>The required scopes must be granted to use FutureOS as a bank.</p> : null}
        </section>
      ) : null}

      {step === "add_reality" ? (
        <section aria-labelledby="ob-reality">
          <h2 id="ob-reality" className={styles.gSectionTitle}>Add your reality</h2>
          <p className={styles.provenance}>Nothing is assumed. Add what you can now — you can add more any time.</p>
          <div className={styles.choiceList}>
            <button type="button" className={styles.choiceBtn} onClick={() => onOpen?.("realityEntry")}>
              <span className={styles.choiceName}>Enter manually</span>
              <span className={styles.choiceHint}>Add an account, income and a bill — takes a minute.</span>
            </button>
            <button type="button" className={styles.choiceBtn} onClick={() => onOpen?.("csvImport")}>
              <span className={styles.choiceName}>Import a CSV</span>
              <span className={styles.choiceHint}>Upload a bank statement export.</span>
            </button>
            <button type="button" className={styles.choiceBtn} onClick={() => onOpen?.("crossBankData")}>
              <span className={styles.choiceName}>Connect an institution</span>
              <span className={styles.choiceHint}>Not connected yet — shown honestly.</span>
            </button>
          </div>
          <div className={styles.rowActions} style={{ marginTop: 12 }}>
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => post({ action: "advance", step: "consent" })}>
              Back
            </button>
            <button type="button" className={styles.primaryBtn} disabled={busy} onClick={() => post({ action: "advance", step: "first_result" })}>
              I've added what I can
            </button>
          </div>
        </section>
      ) : null}

      {step === "first_result" || step === "complete" ? (
        <FirstResult
          busy={busy}
          onFinish={async () => {
            await post({ action: "advance", step: "complete" });
            onComplete?.();
          }}
        />
      ) : null}
    </div>
  );
}

function FirstResult({ onFinish, busy }) {
  const [twin, setTwin] = useState({ status: "loading", data: null });
  useEffect(() => {
    fetch("/api/financial-twin", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTwin({ status: "ready", data: d }))
      .catch(() => setTwin({ status: "error", data: null }));
  }, []);

  const d = twin.data;
  const s2s = d?.safeToSpend;
  return (
    <section aria-labelledby="ob-first">
      <h2 id="ob-first" className={styles.gSectionTitle}>Your first picture</h2>
      {twin.status === "loading" ? (
        <LoadingState />
      ) : d?.isEmpty ? (
        <p>No figures yet — add an account to see your Total cash and Safe-to-Spend. You can still explore the app.</p>
      ) : (
        <ul className={styles.gList}>
          <li>Total cash: SGD {Math.round(d?.twin?.liquidAssets ?? 0).toLocaleString()}</li>
          <li>Safe-to-Spend: SGD {Math.round(s2s?.safeToSpend ?? 0).toLocaleString()}</li>
          <li>Known obligations before next income: SGD {Math.round(s2s?.breakdown?.nearTermObligations ?? 0).toLocaleString()}</li>
          <li>Data completeness: {d?.counts ? `${d.counts.assets + d.counts.liabilities + d.counts.incomeStreams + d.counts.recurring} items added` : "just getting started"}</li>
          <li>Recommended next: {d?.rescueCases?.length ? d.rescueCases[0].whatHappened : "add any missing accounts and open Explore"}</li>
        </ul>
      )}
      <button type="button" className={styles.primaryBtn} style={{ marginTop: 12 }} disabled={busy} onClick={onFinish}>
        Go to my bank
      </button>
    </section>
  );
}
