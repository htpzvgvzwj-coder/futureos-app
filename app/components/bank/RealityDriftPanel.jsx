"use client";

// Reality Drift (Usable RC, section 十一). Reads twin.realityDrift from
// /api/financial-twin. Only shows once the observation window is met and
// the gap is material - a single transaction never moves a long-term plan.

import styles from "./bank.module.css";

export function RealityDriftPanel({ drift = null, onOpen }) {
  if (!drift) return null;
  if (!drift.drifted) {
    return (
      <p className={styles.provenance}>
        {drift.reason === "insufficient_observation"
          ? `Reality Drift needs ${drift.windowMonths} months of observed data (have ${drift.monthsObserved}).`
          : "Your plans still match your observed reality."}
      </p>
    );
  }
  return (
    <div className={styles.bank} aria-label="Reality Drift">
      {drift.cases.map((c) => (
        <section key={c.metric} className={styles.gSection}>
          <h3 className={styles.gSectionTitle}>{c.metric.replace(/_/g, " ")}</h3>
          <p>{c.summary}</p>
          <ul className={styles.gList}>
            <li>Plan assumed: SGD {c.planned}</li>
            <li>Observed ({drift.monthsObserved}-month average): SGD {c.observed}</li>
            <li>Difference: {c.direction} by {c.deltaPct}%</li>
            <li>Observation window: {drift.windowMonths} months</li>
          </ul>
          <div className={styles.rowActions}>
            <button type="button" className={styles.primaryBtn} onClick={() => onOpen?.("mirror", c)}>
              Open Mirror
            </button>
            <button type="button" className={styles.ghostBtn}>Accept new reality</button>
            <button type="button" className={styles.ghostBtn}>Keep original plan</button>
          </div>
        </section>
      ))}
    </div>
  );
}
