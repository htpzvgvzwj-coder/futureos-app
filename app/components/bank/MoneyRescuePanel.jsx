"use client";

// Money Rescue (Usable RC, section 十). Reads twin.rescueCases from
// /api/financial-twin. Each case is calm and actionable - what happened,
// why it matters, what's at risk, confidence, options, recommended step,
// Snooze / Dismiss / Resolve / Open Mirror. Never just a red alert.

import { useState } from "react";
import styles from "./bank.module.css";
import { EmptyState } from "./AsyncState.jsx";
import { FeatureHistory } from "../future-bank/FeatureHistory.jsx";

export function MoneyRescuePanel({ cases = [], onOpen }) {
  const [handled, setHandled] = useState({});
  const live = cases.filter((c) => !handled[c.id]);

  if (!live.length) {
    return (
      <div className={styles.bank} aria-label="Money Rescue">
        <EmptyState title="Nothing needs rescuing" hint="No payment problems, cashflow shortfalls or unusual charges right now." />
        <FeatureHistory feature="money_rescue" label="Recovery actions you've adopted" />
      </div>
    );
  }

  return (
    <div className={styles.bank} aria-label="Money Rescue">
      {live.map((c) => (
        <section key={c.id} className={styles.gSection} aria-labelledby={`mr-${c.id}`}>
          <h3 id={`mr-${c.id}`} className={styles.gSectionTitle}>{c.kind.replace(/_/g, " ")}</h3>
          <p><strong>{c.whatHappened}</strong></p>
          <p className={styles.provenance}>{c.whyItMatters}</p>
          {c.atRisk?.length ? <p className={styles.provenance}>At risk: {c.atRisk.join(", ")}.</p> : null}
          <p className={styles.provenance}>Confidence: {c.confidence}</p>
          {c.options?.length ? (
            <ul className={styles.gList}>
              {c.options.map((o) => (
                <li key={o.id}>
                  {o.label}
                  {o.id === c.recommendedAction ? " — recommended" : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.rowActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => setHandled((h) => ({ ...h, [c.id]: "snoozed" }))}>
              Snooze
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => setHandled((h) => ({ ...h, [c.id]: "dismissed" }))}>
              Dismiss
            </button>
            <button type="button" className={styles.primaryBtn} onClick={() => setHandled((h) => ({ ...h, [c.id]: "resolved" }))}>
              Resolve
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => onOpen?.("mirror", c)}>
              Open Mirror
            </button>
            {c.canContactBank ? (
              <button type="button" className={styles.ghostBtn} onClick={() => onOpen?.("accountDetail", c)}>
                Contact bank
              </button>
            ) : null}
          </div>
        </section>
      ))}
      <FeatureHistory feature="money_rescue" label="Recovery actions you've adopted" />
    </div>
  );
}
