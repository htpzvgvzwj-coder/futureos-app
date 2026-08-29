"use client";

// Wedding Change Replay - a visual causal walkthrough of one recorded
// change, rebuilt from the Change Ledger event's own before/after snapshots
// and impact_set. Nothing here is scripted: the steps come from real data.
//
//   Before -> User action -> Recalculation -> Cross-goal movement
//   -> Guardian response -> Current state

import { useEffect, useMemo, useState } from "react";
import { formatEvent } from "../../../lib/change-ledger/format.js";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

const STEP_KEYS = ["before", "action", "released", "allocation", "crossGoal", "guardian", "current"];

export function WeddingChangeReplay({ t, setActiveScreen }) {
  const [events, setEvents] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/change-ledger?filter=all")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const rows = (d.events ?? []).filter(
          (e) => Array.isArray(e.related_goal_ids) && e.related_goal_ids.some((g) => g === "wedding" || g.startsWith("wedding:")),
        );
        setEvents(rows);
        setSelectedId(rows[0]?.id ?? null);
      })
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, []);

  const event = useMemo(() => (events ?? []).find((e) => e.id === selectedId) ?? null, [events, selectedId]);
  const view = event ? formatEvent(event, t) : null;

  const stepContent = (key) => {
    if (!event) return null;
    const before = event.before_snapshot ?? {};
    const after = event.after_snapshot ?? {};
    const impacts = Array.isArray(event.impact_set) ? event.impact_set : [];
    const weddingImpacts = impacts.filter((i) => i.goalId === "wedding");
    const crossImpacts = impacts.filter((i) => i.goalId && i.goalId !== "wedding");
    switch (key) {
      case "before":
        return Object.keys(before).length
          ? Object.entries(before).map(([k, v]) => (
              <li key={k}>
                {t(`weddingLivingPlan.replay.field.${k}`) === `weddingLivingPlan.replay.field.${k}` ? k : t(`weddingLivingPlan.replay.field.${k}`)}: {String(v)}
              </li>
            ))
          : [<li key="none">{t("weddingLivingPlan.replay.noBefore")}</li>];
      case "action":
        return [<li key="a">{view?.headline}</li>, <li key="who" className="wlpMuted">{t(`changeLedger.actor.${event.actor}`)}</li>];
      case "released":
        if (event.action_type === "allocation_set" && event.cause?.freedCashflow != null) {
          return [<li key="r">{t("weddingLivingPlan.replay.releasedAmount", { amount: sgd(event.cause.freedCashflow) })}</li>];
        }
        return weddingImpacts.length
          ? weddingImpacts.map((i, idx) => (
              <li key={idx}>
                {t(`changeLedger.metric.${i.metric}`)}: {i.before == null ? "—" : i.unit?.includes("sgd") ? sgd(i.before) : i.before} → {i.after == null ? "—" : i.unit?.includes("sgd") ? sgd(i.after) : i.after}
              </li>
            ))
          : [<li key="none">{t("weddingLivingPlan.replay.noRelease")}</li>];
      case "allocation":
        if (event.action_type === "allocation_set") {
          return [
            <li key="h">{t("weddingLivingPlan.allocation.target.home")}: {sgd(after.goalMonthly ?? 0)}/mo</li>,
            <li key="e">{t("weddingLivingPlan.allocation.target.emergency")}: {sgd(after.emergencyMonthly ?? 0)}/mo</li>,
            <li key="f">{t("weddingLivingPlan.allocation.target.flexible")}: {sgd(after.flexibleMonthly ?? 0)}/mo</li>,
          ];
        }
        return [<li key="none">{t("weddingLivingPlan.replay.noAllocation")}</li>];
      case "crossGoal":
        return crossImpacts.length
          ? crossImpacts.map((i, idx) => (
              <li key={idx} className={i.direction === "down" ? "wlpWarn" : ""}>
                {i.goalId}: {i.before ?? "—"} → {i.after ?? "—"}
              </li>
            ))
          : [<li key="none">{t("weddingLivingPlan.replay.noCross")}</li>];
      case "guardian":
        return [
          <li key="g">
            {event.status === "paused"
              ? t("weddingLivingPlan.replay.guardianPaused")
              : event.status === "scheduled"
                ? t("weddingLivingPlan.replay.guardianScheduled")
                : event.status === "revoked"
                  ? t("weddingLivingPlan.replay.guardianRevoked")
                  : t("weddingLivingPlan.replay.guardianTracking")}
          </li>,
        ];
      case "current":
        return [
          <li key="c">{view?.statusLabel}</li>,
          view?.isActual ? null : <li key="n" className="wlpMuted">{t("weddingLivingPlan.replay.notExecuted")}</li>,
        ].filter(Boolean);
      default:
        return null;
    }
  };

  if (events == null) return <section className="wlpView"><p className="wlpMuted">…</p></section>;

  return (
    <section className="wlpView wlpReplay" aria-labelledby="wlpReplayTitle">
      <h3 id="wlpReplayTitle">{t("weddingLivingPlan.replay.title")}</h3>
      {events.length === 0 ? (
        <p className="wlpMuted">{t("weddingLivingPlan.replay.empty")}</p>
      ) : (
        <>
          <label className="wlpReplayPick">
            {t("weddingLivingPlan.replay.pick")}
            <select
              value={selectedId ?? ""}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setStep(0);
              }}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {new Date(e.occurred_at).toLocaleDateString()} — {formatEvent(e, t)?.headline?.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>

          <ol className="wlpReplaySteps">
            {STEP_KEYS.map((k, i) => (
              <li key={k} className={i === step ? "wlpReplayStepActive" : i < step ? "wlpReplayStepDone" : ""}>
                <button type="button" onClick={() => setStep(i)}>
                  {t(`weddingLivingPlan.replay.step.${k}`)}
                </button>
              </li>
            ))}
          </ol>

          <div className="wlpReplayPanel" role="group" aria-label={t(`weddingLivingPlan.replay.step.${STEP_KEYS[step]}`)}>
            <h4>{t(`weddingLivingPlan.replay.step.${STEP_KEYS[step]}`)}</h4>
            <ul>{stepContent(STEP_KEYS[step])}</ul>
          </div>

          <div className="wlpReplayNav">
            <button type="button" className="linkButton" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              {t("weddingLivingPlan.replay.prev")}
            </button>
            <button
              type="button"
              className="linkButton"
              disabled={step === STEP_KEYS.length - 1}
              onClick={() => setStep((s) => s + 1)}
            >
              {t("weddingLivingPlan.replay.next")}
            </button>
            <button type="button" className="linkButton" onClick={() => setActiveScreen("changeLedger")}>
              {t("changeLedger.viewFull")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
