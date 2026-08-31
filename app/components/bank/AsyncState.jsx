"use client";

// Shared production-state primitives (Usable RC, section 十二). Every bank
// surface renders exactly one of: loading / empty / partial-data / stale /
// error(+retry) / success. No raw JSON, no stack traces, no internal ids.

import styles from "./bank.module.css";

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className={styles.stateBox} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint, actions = [] }) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>{title}</p>
      {hint ? <p className={styles.provenance}>{hint}</p> : null}
      {actions.length ? (
        <div className={styles.actions} style={{ marginTop: 10 }}>
          {actions.map((a) => (
            <button key={a.label} type="button" className={styles.actionBtn} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({ message = "This didn't load.", onRetry, errorId }) {
  return (
    <div className={styles.stateBox} role="alert">
      <p>{message} Your data is safe.</p>
      <div className={styles.actions} style={{ marginTop: 8 }}>
        {onRetry ? (
          <button type="button" className={styles.actionBtn} onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
      {errorId ? <p className={styles.provenance}>Reference: {errorId}</p> : null}
    </div>
  );
}

export function StaleBanner({ asOf, onRefresh }) {
  if (!asOf) return null;
  return (
    <div className={styles.staleBanner} role="status">
      <span>Showing data as of {new Date(asOf).toLocaleString()}.</span>
      {onRefresh ? (
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
      ) : null}
    </div>
  );
}

export function PartialDataNote({ completeness }) {
  if (completeness == null || completeness >= 1) return null;
  return (
    <p className={styles.provenance}>
      Data completeness: {Math.round(completeness * 100)}%. Some figures use estimates until you add more.
    </p>
  );
}

// One wrapper: pick the state from a fetch-status string.
export function AsyncBoundary({ status, isEmpty, emptyProps, onRetry, children, loadingLabel }) {
  if (status === "loading" || status === "idle") return <LoadingState label={loadingLabel} />;
  if (status === "error") return <ErrorState onRetry={onRetry} />;
  if (isEmpty) return <EmptyState {...emptyProps} />;
  return children;
}
