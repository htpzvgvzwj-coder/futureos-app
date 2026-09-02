"use client";

// StudioEntryBridge - the ONE shared first-use entry for every Studio.
// Replaces nine separate static "no plan" dead ends.
//
//   title -> why -> 2-3 low-friction questions (chips / cards / month /
//   slider) -> Continue -> server-persisted first path -> the native scene.
//
// "Not sure yet" seeds a system_estimate draft (explorable, NOT sealable).
// "I know the exact amount" reveals text money inputs with the app's own
// inline error (never the browser bubble). "Add it here" opens RealityEntry
// and returns to this same Studio with the answers intact.

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../bank/bank.module.css";
import { LoadingState, ErrorState } from "../bank/AsyncState.jsx";
import { parseMoneyInput, formatMoney } from "../../../lib/money-input.js";

function draftKey(domain) {
  return `studioEntryBridge:${domain}`;
}
function loadDraft(domain) {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(domain)) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
function saveDraft(domain, d) {
  try {
    sessionStorage.setItem(draftKey(domain), JSON.stringify(d));
  } catch {
    /* private mode - fine */
  }
}
function monthOptions([from, to]) {
  const out = [];
  const now = new Date();
  for (let i = from; i <= to; i += Math.max(1, Math.round((to - from) / 12))) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push({ id: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-SG", { month: "short", year: "numeric" }) });
  }
  return out;
}

export function StudioEntryBridge({ domain, requirements, onSeeded, onOpenRealityEntry, onBack }) {
  const [req, setReq] = useState(requirements ?? null);
  const [status, setStatus] = useState(requirements ? "ready" : "loading");
  const [answers, setAnswers] = useState(() => loadDraft(domain).answers ?? {});
  const [showExact, setShowExact] = useState(false);
  const [exact, setExact] = useState(() => loadDraft(domain).exact ?? {});
  const [exactErrors, setExactErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchReq = useCallback(async () => {
    if (requirements) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/future-field?domain=${encodeURIComponent(domain)}`, { headers: { "cache-control": "no-cache" } });
      const d = await res.json();
      if (d.entryRequirements) {
        setReq(d.entryRequirements);
        setStatus("ready");
      } else if (d.hasRealityPath) {
        onSeeded?.(); // already has a path - let the parent re-render the scene
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [domain, requirements, onSeeded]);
  useEffect(() => {
    fetchReq();
  }, [fetchReq]);

  useEffect(() => {
    saveDraft(domain, { answers, exact });
  }, [domain, answers, exact]);

  const setAnswer = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));

  const allRequiredAnswered = useMemo(() => {
    if (!req) return false;
    return req.questions.every((q) => answers[q.id] != null && answers[q.id] !== "");
  }, [req, answers]);

  const seed = async (mode) => {
    setBusy(true);
    setError("");
    // validate exact amounts if shown
    const exactAmounts = {};
    if (showExact) {
      const errs = {};
      for (const f of req.exactAmountFields ?? []) {
        const raw = exact[f.field];
        if (raw == null || raw === "") continue;
        const parsed = parseMoneyInput(raw, { min: 0 });
        if (!parsed.ok) errs[f.field] = parsed.error;
        else exactAmounts[f.field] = parsed.value;
      }
      if (Object.keys(errs).length) {
        setExactErrors(errs);
        setBusy(false);
        return;
      }
      setExactErrors({});
    }
    try {
      const res = await fetch("/api/future-field/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, answers, exactAmounts, mode }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error === "missing_answers" ? "Please answer the questions above first." : d.error ?? "Could not start your path.");
        return;
      }
      try {
        sessionStorage.removeItem(draftKey(domain));
      } catch {
        /* fine */
      }
      onSeeded?.(d);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return <LoadingState label="Getting things ready…" />;
  if (status === "error" || !req) return <ErrorState onRetry={fetchReq} message="This Studio could not load its first step." />;

  return (
    <div className={`${styles.bank} ${styles.wizard}`} aria-label={req.title}>
      {onBack ? (
        <button type="button" className={styles.ghostBtn} onClick={onBack} style={{ alignSelf: "flex-start" }}>
          ← Back
        </button>
      ) : null}

      <div className={styles.headline}>
        <span className={styles.headlineLabel}>{req.firstResult}</span>
        <h1 style={{ fontSize: 22, margin: "2px 0" }}>{req.title}</h1>
      </div>
      <p className={styles.provenance}>{req.why}</p>
      {req.disclaimer ? <p className={styles.fieldError}>{req.disclaimer}</p> : null}

      {req.questions.map((q) => (
        <fieldset key={q.id} className={styles.gSection} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className={styles.gSectionTitle}>{q.label}</legend>

          {(q.kind === "range_chips" || q.kind === "cards") && (
            <div className={styles.choiceList} style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {q.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={styles.choiceBtn}
                  style={{ flex: "1 1 40%" }}
                  aria-pressed={answers[q.id] === o.id}
                  onClick={() => setAnswer(q.id, o.id)}
                >
                  <span className={styles.choiceName}>{o.label}</span>
                </button>
              ))}
            </div>
          )}

          {q.kind === "month" && (
            <select className={styles.field} value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} aria-label={q.label}>
              <option value="">— choose a month —</option>
              {monthOptions(q.monthsAhead ?? [3, 36]).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {(q.kind === "slider" || q.kind === "count") && (
            <label className={styles.field}>
              <input
                type="range"
                min={q.min ?? 0}
                max={q.max ?? 12}
                step={q.step ?? 1}
                value={answers[q.id] ?? q.default ?? q.min ?? 0}
                onChange={(e) => setAnswer(q.id, Number(e.target.value))}
                aria-label={q.label}
              />
              <span>{answers[q.id] ?? q.default ?? q.min ?? 0}</span>
            </label>
          )}
        </fieldset>
      ))}

      {/* optional: exact amounts */}
      {(req.exactAmountFields ?? []).length > 0 && (
        <div className={styles.gSection}>
          {!showExact ? (
            <button type="button" className={styles.ghostBtn} onClick={() => setShowExact(true)}>
              I know the exact amount
            </button>
          ) : (
            <>
              <p className={styles.gSectionTitle}>Exact amounts (optional)</p>
              {req.exactAmountFields.map((f) => (
                <label key={f.field} className={styles.field}>
                  <span>{f.label}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={exact[f.field] ?? ""}
                    placeholder="e.g. 1,000"
                    onChange={(e) => setExact((x) => ({ ...x, [f.field]: e.target.value }))}
                    onBlur={(e) => {
                      const p = parseMoneyInput(e.target.value, { min: 0 });
                      if (p.ok) setExact((x) => ({ ...x, [f.field]: formatMoney(p.value) }));
                    }}
                    aria-invalid={Boolean(exactErrors[f.field])}
                  />
                  {exactErrors[f.field] ? <span className={styles.fieldError}>{exactErrors[f.field]}</span> : null}
                </label>
              ))}
              <p className={styles.provenance}>
                Don't have these to hand?{" "}
                <button type="button" className={styles.catalogCta} onClick={() => onOpenRealityEntry?.(domain)}>
                  Add it here
                </button>{" "}
                — you'll come straight back.
              </p>
            </>
          )}
        </div>
      )}

      {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}

      <div className={styles.rowActions}>
        <button type="button" className={styles.primaryBtn} disabled={busy || !allRequiredAnswered} onClick={() => seed("confirmed")}>
          {busy ? "Working…" : "Show my first path"}
        </button>
        <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => seed("estimate")}>
          Not sure yet — use estimates
        </button>
      </div>
      <p className={styles.provenance}>
        An estimate path is fully explorable, but you'll need to confirm the flagged values before it can be sealed.
      </p>
    </div>
  );
}
