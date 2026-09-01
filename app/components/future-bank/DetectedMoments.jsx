"use client";

// "One thing that needs you" (Today) and "Future Bank noticed" (Explore).
// Renders real MoneyMoments with visible evidence, confidence, affected
// plans and one real next action. The lifecycle actions (reviewed /
// snoozed / resolved / acknowledged) are persisted server-side via the
// FutureBankDataProvider `act()` - never React-only.
//
// Calm state is explicit: when there is no real signal it says so and then
// shows what Future Bank is currently watching, from the available data.

import { useState } from "react";
import css from "./future-bank.module.css";
import { useFutureBankData } from "./FutureBankDataProvider.jsx";
import { afterLabel, directionClass, relTime } from "./format.js";

function MomentCard({ moment, onRoute }) {
  const { act } = useFutureBankData();
  const [busy, setBusy] = useState(null);

  const run = async (action, opts) => {
    setBusy(action);
    await act(action, moment.id, { evidenceHash: moment.evidenceHash, ...opts });
    setBusy(null);
  };

  const primary = (moment.nextActions ?? [])[0] ?? null;
  const affected = (moment.affectedPlans ?? []).filter((p) => p.domain);

  return (
    <article className={`${css.moment} ${css[moment.severity] || ""}`}>
      <div className={css.momentTop}>
        <span className={`${css.sev} ${css[moment.severity] || ""}`}>{String(moment.severity).replace("_", " ")}</span>
        {moment.reopened ? <span className={css.reopened}>Reopened</span> : null}
        <span className={css.evMeta} style={{ marginLeft: "auto" }}>{relTime(moment.occurredAt)}</span>
      </div>
      <div className={css.momentTitle}>{moment.title}</div>
      <div className={css.momentSummary}>{moment.summary}</div>
      {moment.whyNow ? <div className={css.evMeta}>Why now: {moment.whyNow}</div> : null}

      {(moment.evidence ?? []).length > 0 && (
        <div className={css.evidence}>
          {moment.evidence.map((e, i) => (
            <div key={i} className={css.evRow}>
              <span>{e.label}</span>
              <span>{e.value ?? "Needs more information"}</span>
            </div>
          ))}
          <div className={css.evMeta}>
            source: {moment.evidence[0]?.source} · confidence: {moment.evidence[0]?.confidence} · {moment.evidence[0]?.provenance}
          </div>
        </div>
      )}

      {affected.length > 0 && (
        <div className={css.movement}>
          {affected.map((a, i) => {
            const al = afterLabel(a);
            return (
              <div key={i} className={css.moveRow}>
                <span className="k">{String(a.domain).replace(/_/g, " ")}</span>
                <span className={`v ${al.value === "Needs more information" ? "unknown" : directionClass(a)}`}>
                  {a.before != null ? `${a.before} → ` : ""}
                  {al.value}
                  {al.tag ? <span className={al.tagKind === "committed" ? css.committedNote : css.previewNote}> · {al.tag}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className={css.momentActions}>
        {primary ? (
          <button
            type="button"
            className={`${css.act} ${css.primary}`}
            disabled={!primary.available || busy != null}
            onClick={() =>
              primary.id === "acknowledge"
                ? run("acknowledged")
                : primary.route
                  ? onRoute?.(primary.route, moment)
                  : run("reviewed")
            }
          >
            {busy === "acknowledged" ? "Saving…" : primary.label}
          </button>
        ) : null}
        {primary && !primary.available && primary.unavailableReason ? (
          <span className={css.evMeta}>{primary.unavailableReason}</span>
        ) : null}
        <button type="button" className={css.act} disabled={busy != null} onClick={() => run("reviewed")}>
          Mark reviewed
        </button>
        <button type="button" className={css.act} disabled={busy != null} onClick={() => run("snoozed", { snoozeDays: 7 })}>
          Snooze 7d
        </button>
      </div>
    </article>
  );
}

// Today: at most one. Explore: up to `limit`.
export function DetectedMoments({ limit = 1, onRoute, showWatchingWhenCalm = true, exclude = [] }) {
  const { moments, watching, status } = useFutureBankData();
  if (status === "loading" && !moments.length) return <p className={css.empty}>Checking your money…</p>;

  const shown = (moments ?? []).filter((m) => !exclude.includes(m.sourceType)).slice(0, limit);
  if (shown.length === 0) {
    return (
      <div className={css.calm}>
        <span className={css.calmTitle}>Nothing needs your attention right now.</span>
        {showWatchingWhenCalm && (
          <>
            <span className={css.empty}>Future Bank is watching, based on the data it has:</span>
            <div className={css.watchList}>
              {(watching ?? []).map((w, i) => (
                <div key={i} className={`${css.watchItem} ${w.active ? "" : css.off}`}>
                  <span className={css.watchDot} />
                  <span>
                    {w.label}
                    {!w.active ? ` — ${w.reason}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={css.section}>
      {shown.map((m) => (
        <MomentCard key={m.id} moment={m} onRoute={onRoute} />
      ))}
    </div>
  );
}
