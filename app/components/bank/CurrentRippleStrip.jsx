"use client";

// The persistent Current Ripple strip. Rendered in Today / Life / Explore /
// Guardian and every Studio, always reading the SAME /api/ripple payload
// (buildCurrentRipple over persisted ripple_events). It does not disappear
// on navigation or reload.

import styles from "./bank.module.css";

const ACTION_LABEL = {
  compare: "Compare",
  undo: "Undo",
  seal: "Seal",
  view_cause: "See why",
  open_history: "Open History",
};

export function CurrentRippleStrip({ ripple, onAction, compact = false }) {
  const e = ripple?.mostRecent ?? null;
  if (!e) {
    return compact ? null : <p className={styles.provenance}>No recent changes to your plan.</p>;
  }
  return (
    <div className={styles.rippleStrip} role="status" aria-label="Current Ripple">
      <span className={styles.rippleState}>
        {e.severity === "action_required" ? "Action needed" : e.severity === "turning_point" ? "Turning point" : "Change"} · {e.state}
      </span>
      <strong>{e.whatChanged}</strong>
      {e.monthlyImpact != null ? (
        <span>
          Monthly impact: SGD {e.monthlyImpact >= 0 ? "+" : ""}
          {e.monthlyImpact}
        </span>
      ) : null}
      {(e.affectedGoals ?? []).map((g, i) => (
        <span key={i} className={styles.txnMeta}>
          {g.goalId}
          {g.before != null && g.after != null ? `: ${g.before} → ${g.after}` : ""} ({g.direction})
        </span>
      ))}
      <span className={styles.txnMeta}>Confidence: {e.confidence}</span>
      {!compact && e.nextActions?.length ? (
        <div className={styles.rippleActions}>
          {e.nextActions.map((a) => (
            <button key={a} type="button" onClick={() => onAction?.(a, e)}>
              {ACTION_LABEL[a] ?? a}
            </button>
          ))}
        </div>
      ) : null}
      {ripple.count > 1 ? <span className={styles.txnMeta}>+{ripple.count - 1} more change{ripple.count - 1 === 1 ? "" : "s"}</span> : null}
    </div>
  );
}
