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
  account_data: { name: "Accounts and balances", why: "Show your real balances and what is available now.", affects: "Today, Life and Safe-to-Spend." },
  transaction_data: { name: "Transactions and spending", why: "Find spending patterns, recurring bills and unusual payments.", affects: "Activity, spending insights and Money Rescue." },
  assets_liabilities: { name: "Assets and debts", why: "Build your net-worth picture and calculate what plans really cost.", affects: "Financial Twin and every plan." },
  planning_data: { name: "Plans and history", why: "Keep the paths you create and explain what changed.", affects: "Studios, Mirror and History." },
  shared_data: { name: "Shared planning", why: "Let invited people see only the ranges you agree to share.", affects: "Shared Money and Family." },
  guardian_monitoring: { name: "Guardian monitoring", why: "Watch real money against plans you have confirmed.", affects: "Guardian alerts and check-ins." },
};

const CONSENT_GROUPS = [
  { id: "essential", title: "Essential for your bank", scopes: ["account_data"] },
  { id: "intelligence", title: "Intelligence you can enable", scopes: ["transaction_data", "assets_liabilities", "planning_data"] },
  { id: "people", title: "People and Guardian", scopes: ["shared_data", "guardian_monitoring"] },
];

export function OnboardingWizard({ onComplete, onOpen }) {
  const [state, setState] = useState({ status: "loading", onboarding: null, consent: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
    setMessage("");
    try {
      const res = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage("We could not save that change. Please try again.");
        return { ok: false, data };
      }
      if (data.onboarding) setState((s) => ({ ...s, onboarding: data.onboarding }));
      if (data.consent) setState((s) => ({ ...s, consent: data.consent }));
      return { ok: true, data };
    } catch {
      setMessage("Your connection was interrupted. Please try again.");
      return { ok: false, data: null };
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "loading") return <LoadingState label="Setting up Future Bank…" />;
  if (state.status === "error") return <ErrorState onRetry={load} message="Onboarding could not load." />;

  const step = state.onboarding?.step ?? "account_type";
  const stepIndex = ["account_type", "consent", "add_reality", "first_result", "complete"].indexOf(step);
  const requiredConsent = state.consent.filter((c) => c.required);
  const requiredGranted = requiredConsent.every((c) => c.granted);

  return (
    <div className={`${styles.bank} ${styles.wizard}`} aria-label="Set up Future Bank" data-onboarding-shell>
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
        <section aria-labelledby="ob-consent" className={styles.consentStep}>
          <div className={styles.wizardIntro}>
            <p className={styles.wizardEyebrow}>Your control</p>
            <h2 id="ob-consent" className={styles.wizardTitle}>Choose what Future Bank may use</h2>
            <p className={styles.wizardLead}>Start with the one permission needed to show your bank. Everything else is optional and can be changed later.</p>
          </div>

          <div className={styles.consentGroups}>
            {CONSENT_GROUPS.map((group) => {
              const rows = state.consent.filter((c) => group.scopes.includes(c.scope));
              if (!rows.length) return null;
              return (
                <fieldset key={group.id} className={styles.consentGroup}>
                  <legend>{group.title}</legend>
                  {rows.map((c) => {
                    const copy = CONSENT_COPY[c.scope] ?? {};
                    return (
                      <div key={c.scope} className={styles.consentRow}>
                        <input
                          id={`consent-${c.scope}`}
                          type="checkbox"
                          checked={c.granted}
                          aria-describedby={`consent-help-${c.scope}`}
                          onChange={async (e) => {
                            const granted = e.target.checked;
                            const previous = c.granted;
                            setState((s) => ({ ...s, consent: s.consent.map((x) => (x.scope === c.scope ? { ...x, granted } : x)) }));
                            const result = await post({ action: "set_consent", scope: c.scope, granted });
                            if (!result.ok) {
                              setState((s) => ({ ...s, consent: s.consent.map((x) => (x.scope === c.scope ? { ...x, granted: previous } : x)) }));
                            }
                          }}
                        />
                        <label htmlFor={`consent-${c.scope}`}>
                          <span className={styles.consentName}>
                            {copy.name ?? c.scope.replace(/_/g, " ")}
                            <span className={c.required ? styles.consentReq : styles.consentOptional}>{c.required ? "Required" : "Optional"}</span>
                          </span>
                          <span id={`consent-help-${c.scope}`} className={styles.consentHelp}>{copy.why}</span>
                          <details className={styles.consentDetails}>
                            <summary>Where this appears</summary>
                            <span>{copy.affects} You can revoke or change this later in Account controls.</span>
                          </details>
                        </label>
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>

          <div className={styles.wizardActionBar}>
            {message ? <p className={styles.fieldError} role="alert">{message}</p> : null}
            {!requiredGranted ? <p className={styles.actionHint}>Enable Accounts and balances to continue.</p> : null}
            <div className={styles.rowActions}>
              <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => post({ action: "advance", step: "account_type" })}>
                Back
              </button>
              <button type="button" className={styles.primaryBtn} disabled={busy || !requiredGranted} onClick={() => post({ action: "advance", step: "add_reality" })}>
                {busy ? "Saving…" : "Continue to add your reality"}
              </button>
            </div>
          </div>
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
