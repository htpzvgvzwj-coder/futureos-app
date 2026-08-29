"use client";

// Change Ledger UI - the causal timeline, per-entry detail, Change Replay
// (before/after for the 1-3 affected goals), Delta Replay ("since you last
// opened"), and the compact Impact Receipt shown right after an action.
//
// All copy comes from lib/change-ledger/format.js via the `t` prop - this
// file builds no ledger sentences itself.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronRight, CircleDot, Clock3 } from "lucide-react";
import { formatEvent, formatImpactReceipt } from "../../lib/change-ledger/format.js";

const FILTERS = ["all", "mine", "guardian", "plan", "quotes", "shared", "outcomes"];

const TRUTHFULNESS_CLASS = {
  projected: "clTruth clTruthProjected",
  simulated: "clTruth clTruthSimulated",
  scheduled: "clTruth clTruthScheduled",
  active: "clTruth clTruthActive",
  paused: "clTruth clTruthPaused",
  revoked: "clTruth clTruthRevoked",
  completed: "clTruth clTruthCompleted",
  observed: "clTruth clTruthObserved",
};

function TruthChip({ view }) {
  return <span className={TRUTHFULNESS_CLASS[view.truthfulnessKey] ?? "clTruth"}>{view.statusLabel}</span>;
}

// uncertainty notes can carry a ":detail" suffix (e.g.
// "budget_impact_pending:guest_count") - resolve the base key and append the
// detail so nothing renders as a raw slug.
function uncertaintyText(t, note) {
  if (!note) return null;
  const [base, detail] = String(note).split(":");
  const resolved = t(`changeLedger.uncertainty.${base}`);
  const text = resolved === `changeLedger.uncertainty.${base}` ? note : resolved;
  return detail ? `${text} (${detail})` : text;
}

// Change Replay: the before/after of the affected goals for one event.
// Deliberately capped at 3 rows so it never floods.
function ChangeReplay({ event, t }) {
  const view = formatEvent(event, t);
  if (!view || view.impactLines.length === 0) {
    return view?.uncertaintyNote ? (
      <p className="clUncertain">{uncertaintyText(t, view.uncertaintyNote)}</p>
    ) : null;
  }
  return (
    <div className="clReplay" role="group" aria-label={t("changeLedger.impactTitle")}>
      {view.impactLines.map((line, i) => (
        <div key={i} className={`clReplayRow clReplayRow-${line.direction ?? "flat"}`}>
          <CircleDot size={13} aria-hidden />
          <span>{line.text}</span>
        </div>
      ))}
      {view.uncertaintyNote ? <p className="clUncertain">{uncertaintyText(t, view.uncertaintyNote)}</p> : null}
    </div>
  );
}

function LedgerEntry({ event, t, expanded, onToggle }) {
  const view = formatEvent(event, t);
  if (!view) return null;
  const noLongerInEffect = event.status === "revoked" || event.supersededByThis;
  return (
    <li className={`clEntry${noLongerInEffect ? " clEntryStruck" : ""}`}>
      <button type="button" className="clEntryHead" onClick={onToggle} aria-expanded={expanded}>
        <span className="clEntryWhen">
          <Clock3 size={12} aria-hidden /> {new Date(view.occurredAt).toLocaleDateString()}
        </span>
        <span className="clEntryActor">{t(`changeLedger.actor.${view.actor}`)}</span>
        <strong className="clEntryHeadline">{view.headline}</strong>
        {expanded ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
      </button>
      <div className="clEntryMetaRow">
        <TruthChip view={view} />
        {noLongerInEffect ? <span className="clStruckNote">{t("changeLedger.noLongerInEffect")}</span> : null}
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            className="clEntryDetail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {view.detail ? <p className="clDetailText">{view.detail}</p> : null}
            <ChangeReplay event={event} t={t} />
            {event.cause && Object.keys(event.cause).length ? (
              <details className="clRaw">
                <summary>{t("changeLedger.causeTitle")}</summary>
                <pre>{JSON.stringify(event.cause, null, 2)}</pre>
              </details>
            ) : null}
            {Array.isArray(event.evidence_refs) && event.evidence_refs.length ? (
              <details className="clRaw">
                <summary>{t("changeLedger.evidenceTitle")}</summary>
                <ul>
                  {event.evidence_refs.map((ref, i) => (
                    <li key={i}>
                      {ref.kind}: {ref.ref} {ref.sourceUpdatedAt ? `(${new Date(ref.sourceUpdatedAt).toLocaleDateString()})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

export function ChangeLedgerScreen({ t, setActiveScreen, backTo = "lifeGraph" }) {
  const [filter, setFilter] = useState("all");
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async (nextFilter) => {
    setEvents(null);
    setError("");
    try {
      const res = await fetch(`/api/change-ledger?filter=${encodeURIComponent(nextFilter)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(t("changeLedger.empty"));
        setEvents([]);
        return;
      }
      setEvents(data.events ?? []);
    } catch {
      setError(t("changeLedger.empty"));
      setEvents([]);
    }
  }, [t]);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <section className="screen clScreen">
      <button type="button" className="linkButton clBack" onClick={() => setActiveScreen(backTo)}>
        <ArrowLeft size={16} aria-hidden /> {t("changeLedger.back")}
      </button>
      <header className="clHeader">
        <h1>{t("changeLedger.title")}</h1>
        <p>{t("changeLedger.subtitle")}</p>
      </header>

      <div className="clFilters" role="tablist" aria-label={t("changeLedger.title")}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`clFilterChip${filter === f ? " clFilterChipActive" : ""}`}
            onClick={() => setFilter(f)}
          >
            {t(`changeLedger.filter.${f}`)}
          </button>
        ))}
      </div>

      {events == null ? (
        <p className="clLoading">…</p>
      ) : events.length === 0 ? (
        <p className="clEmpty">{error || t("changeLedger.empty")}</p>
      ) : (
        <ol className="clTimeline">
          {events.map((event) => (
            <LedgerEntry
              key={event.id}
              event={event}
              t={t}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId((cur) => (cur === event.id ? null : event.id))}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

// Compact receipt shown immediately after an action. `event` is the raw
// ledger row returned by the acting endpoint (or fetched by id).
export function ImpactReceipt({ event, t, onViewFull }) {
  const receipt = useMemo(() => (event ? formatImpactReceipt(event, t) : null), [event, t]);
  if (!receipt) return null;
  return (
    <motion.section
      className="clReceipt"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <strong className="clReceiptHeadline">{receipt.headline}</strong>
      <span className={TRUTHFULNESS_CLASS[receipt.truthfulnessKey] ?? "clTruth"}>{receipt.statusLabel}</span>
      {receipt.topImpacts.length ? (
        <ul className="clReceiptImpacts">
          {receipt.topImpacts.map((line, i) => (
            <li key={i} className={`clReplayRow-${line.direction ?? "flat"}`}>
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
      {receipt.uncertaintyNote ? (
        <p className="clUncertain">{uncertaintyText(t, receipt.uncertaintyNote)}</p>
      ) : null}
      {onViewFull ? (
        <button type="button" className="linkButton" onClick={onViewFull}>
          {t("changeLedger.viewFull")}
        </button>
      ) : null}
    </motion.section>
  );
}

// A goal-scoped slice ("What has changed for this goal") - filters the same
// feed to events touching `goalId`.
export function GoalChangeHistory({ goalId, t, setActiveScreen }) {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/change-ledger?filter=all`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const rows = (d.events ?? []).filter(
          (e) => Array.isArray(e.related_goal_ids) && e.related_goal_ids.some((g) => g === goalId || g.startsWith(`${goalId}:`)),
        );
        setEvents(rows);
      })
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [goalId]);

  if (events == null) return null;
  if (events.length === 0) return null;
  return (
    <section className="clGoalHistory">
      <h3>{t("changeLedger.goalSectionTitle")}</h3>
      <ol className="clTimeline clTimelineCompact">
        {events.slice(0, 5).map((event) => {
          const view = formatEvent(event, t);
          return (
            <li key={event.id} className="clEntry">
              <strong className="clEntryHeadline">{view?.headline}</strong>
              {view ? <TruthChip view={view} /> : null}
            </li>
          );
        })}
      </ol>
      <button type="button" className="linkButton" onClick={() => setActiveScreen("changeLedger")}>
        {t("changeLedger.viewFull")}
      </button>
    </section>
  );
}
