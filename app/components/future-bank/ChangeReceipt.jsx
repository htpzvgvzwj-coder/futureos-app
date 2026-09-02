"use client";

// The persisted, server-authoritative Change Receipt for a Studio change:
//
//   Before -> what you changed -> new plan result -> monthly money
//   added/released -> every materially affected plan/goal -> Preview or
//   Committed -> Guardian response -> current state -> next action
//
// Every value here is server-computed (from /api/future-field impacts +
// Life Thread). Nothing local. Internal reason strings are never shown -
// `humanReason` is passed in already translated.

import css from "./future-bank.module.css";
import { monthly, afterLabel, directionClass, humanMetric, isMaterial } from "./format.js";

export function ChangeReceipt({
  before, // string: prior state, e.g. "Monthly pace SGD 1,000 · window 2035-02"
  changed, // string: the user action, e.g. "Set aside SGD 1,500 each month"
  after, // string: new plan result
  monthlyAdded = null, // number | null  (added pressure)
  monthlyReleased = null, // number | null
  affected = [], // [{ domain, metric, unit, before, possibleAfter, confirmedAfter, direction, favourable }]
  committed = false, // sealed?
  guardianResponse = null, // string | null
  humanReason = null, // already-translated seal-block / consequence sentence
  nextAction = null, // { label, onClick } | null
  onHistory = null,
}) {
  const moved = affected.filter(isMaterial);
  return (
    <section className={css.receipt} aria-label="Change receipt">
      <div className={css.receiptRow}>
        <span className={css.rk}>Before</span>
        <span>{before}</span>
      </div>
      <div className={css.receiptRow}>
        <span className={css.rk}>You changed</span>
        <span>{changed}</span>
      </div>
      <div className={css.receiptRow}>
        <span className={css.rk}>New result</span>
        <span>{after}</span>
      </div>
      {(monthlyAdded != null || monthlyReleased != null) && (
        <div className={css.receiptRow}>
          <span className={css.rk}>Monthly money</span>
          <span>
            {monthlyAdded ? (committed ? `${monthly(monthlyAdded)} more committed` : `${monthly(monthlyAdded)} proposed monthly pressure`) : null}
            {monthlyAdded && monthlyReleased ? " · " : null}
            {monthlyReleased ? (committed ? `${monthly(monthlyReleased)} released` : `${monthly(monthlyReleased)} could be released`) : null}
            {!monthlyAdded && !monthlyReleased ? "No change to your monthly total" : null}
          </span>
        </div>
      )}
      {moved.length > 0 &&
        moved.map((a, i) => {
          const al = afterLabel(a);
          const fmt = (v) =>
            a.unit === "sgd_per_month" && v != null && Number.isFinite(Number(v))
              ? `SGD ${Math.round(Number(v)).toLocaleString("en-SG")}`
              : String(v);
          return (
            <div key={i} className={`${css.receiptRow} ${css.moved}`}>
              <span className={css.rk}>Moved</span>
              <span>
                <b style={{ textTransform: "capitalize" }}>{String(a.domain).replace(/_/g, " ")}</b>
                {" · "}
                {humanMetric(a.metric)}:{" "}
                <span className={css[directionClass(a)] || undefined}>
                  {a.before != null ? `${fmt(a.before)} → ` : ""}
                  {al.value === "Needs more information" ? al.value : fmt(al.value)}
                </span>
                {al.tag ? (
                  <span className={al.tagKind === "committed" ? css.committedNote : css.previewNote}> · {al.tag}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      {moved.length === 0 && (
        <div className={css.receiptRow}>
          <span className={css.rk}>Moved</span>
          <span className={css.empty}>No other plan is materially affected yet.</span>
        </div>
      )}
      <div className={css.receiptRow}>
        <span className={css.rk}>Status</span>
        <span>
          <span className={committed ? css.committedNote : css.previewNote}>{committed ? "Committed" : "Preview"}</span>
          {humanReason ? ` — ${humanReason}` : committed ? " — this is a real commitment." : " — nothing is locked in yet."}
        </span>
      </div>
      {guardianResponse ? (
        <div className={css.receiptRow}>
          <span className={css.rk}>Guardian</span>
          <span>{guardianResponse}</span>
        </div>
      ) : null}
      {nextAction ? (
        <button type="button" className={`${css.act} ${css.primary}`} style={{ marginTop: 4 }} onClick={nextAction.onClick}>
          {nextAction.label}
        </button>
      ) : null}
      {onHistory ? (
        <button type="button" className={css.act} onClick={onHistory}>
          View full history
        </button>
      ) : null}
    </section>
  );
}
