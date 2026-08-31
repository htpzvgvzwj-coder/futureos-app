"use client";

// The two optional drawers under a scene. Both are CLOSED by default and
// mount their contents lazily. They are never a "phase" - the customer
// opens them deliberately.

import { useEffect, useState } from "react";
import { useLivingScene } from "./LivingSceneProvider.jsx";

const TAG_KEY = {
  fact: "livingScene.memory.tag.fact",
  user_choice: "livingScene.memory.tag.userChoice",
  estimate: "livingScene.memory.tag.estimate",
  inference: "livingScene.memory.tag.inference",
  unknown: "livingScene.memory.tag.unknown",
};

export function EvidenceDrawer({ t, open, onToggle, rows = [], unknowns = [], note = null }) {
  return (
    <details className="lsDrawer lsEvidenceDrawer" open={open} onToggle={(e) => onToggle?.(e.currentTarget.open)}>
      <summary>{t("livingScene.reality.evidenceTitle")}</summary>
      <div className="lsDrawerBody">
        <dl className="lsRealityRows">
          {rows.map((r) => (
            <div key={r.id} className="lsRealityRow">
              <dt>{r.label}</dt>
              <dd>
                <b>{r.value}</b>
                {r.provenance ? <span className="lsProvenance">{r.provenance}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
        {unknowns.length ? (
          <div className="lsUnknowns">
            <p className="lsUnknownsHead">{t("livingScene.reality.unknownHead")}</p>
            <ul>
              {unknowns.map((u) => (
                <li key={u.id}>{u.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {note ? <p className="lsProvenance lsNote">{note}</p> : null}
      </div>
    </details>
  );
}

// ThreadMemoryScrubber (Living Thread commit 12) - drag back through this
// Studio's real plan_versions and see the plan state Before | After. No
// invented values; an absent field reads as "unknown".
export function ThreadMemoryScrubber({ t }) {
  const s = useLivingScene();
  const [open, setOpen] = useState(false);
  const [scrub, setScrub] = useState(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open || scrub) return;
    let alive = true;
    fetch(`/api/memory-scrub?domain=${encodeURIComponent(s.domain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setScrub(d);
        setPos(d?.count ? d.count - 1 : 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, scrub, s.domain]);

  const frames = scrub?.frames ?? [];
  const idx = pos == null ? Math.max(0, frames.length - 1) : Math.max(0, Math.min(frames.length - 1, pos));
  const after = frames[idx]?.state ?? {};
  const before = idx > 0 ? frames[idx - 1]?.state ?? {} : {};
  const keys = scrub?.keys?.length ? scrub.keys : Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changed = keys.filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));

  const fmt = (v) => (v === undefined || v === null ? t("livingScene.scrub.unknown") : typeof v === "object" ? JSON.stringify(v) : String(v));

  return (
    <details className="lsDrawer lsScrubDrawer" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t("livingScene.scrub.drawerTitle")}</summary>
      <div className="lsDrawerBody">
        {frames.length < 2 ? (
          <p className="lsProvenance">{open ? t("livingScene.scrub.tooShort") : ""}</p>
        ) : (
          <>
            <input
              type="range"
              className="lsScrubRange"
              min={1}
              max={frames.length - 1}
              value={idx}
              aria-label={t("livingScene.scrub.handle")}
              onChange={(e) => setPos(Number(e.target.value))}
            />
            <p className="lsScrubStep">
              {t("livingScene.scrub.step", { n: idx, of: frames.length - 1, actor: frames[idx]?.actor ?? "system" })}
            </p>
            {changed.length === 0 ? (
              <p className="lsProvenance">{t("livingScene.scrub.noChange")}</p>
            ) : (
              <table className="lsScrubTable">
                <thead>
                  <tr>
                    <th>{t("livingScene.scrub.field")}</th>
                    <th>{t("livingScene.scrub.before")}</th>
                    <th>{t("livingScene.scrub.after")}</th>
                  </tr>
                </thead>
                <tbody>
                  {changed.map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{fmt(before[k])}</td>
                      <td>{fmt(after[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </details>
  );
}

// GuardianRail (Living Thread commit 12) - the persistent, visible watch
// state after Seal. Guardian NEVER moves money or changes the plan; this
// rail just shows what it watches and what it may not do, plus Stand down.
export function GuardianRail({ t }) {
  const s = useLivingScene();
  if (!s.sealState?.sealed) return null;
  const policy = s.sealState.guardianPolicy ?? null;
  const watching = policy?.watching ?? policy?.pause_conditions ?? [];
  const stoodDown = s.guardianStandDown;

  return (
    <section className={`lsGuardianRail ${stoodDown ? "is-stood-down" : ""}`} aria-label={t("livingScene.guardianRail.title")}>
      <div className="lsGuardianRailHead">
        <span className="lsGuardianRailDot" aria-hidden="true" />
        <b>{stoodDown ? t("livingScene.guardianRail.stoodDown") : t("livingScene.guardianRail.watching")}</b>
        {!stoodDown ? (
          <button type="button" className="lsGhostBtn" onClick={() => s.standDownGuardian?.()}>{t("livingScene.guardianRail.standDown")}</button>
        ) : null}
      </div>
      {!stoodDown ? (
        <>
          {Array.isArray(watching) && watching.length ? (
            <p className="lsGuardianRailWatch">{t("livingScene.guardianRail.watches", { list: watching.join(", ") })}</p>
          ) : null}
          <p className="lsGuardianRailNever">{t("livingScene.guardianRail.never")}</p>
        </>
      ) : null}
    </section>
  );
}

export function MemoryDrawer({ t, setActiveScreen }) {
  const s = useLivingScene();
  const [open, setOpen] = useState(false);
  const [lens, setLens] = useState(null);
  const [handoffs, setHandoffs] = useState([]);

  useEffect(() => {
    if (!open || lens) return;
    let alive = true;
    fetch(`/api/living-plan/memory-lens?goal=${encodeURIComponent(s.domain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setLens(d))
      .catch(() => {});
    fetch("/api/living-plan/handoffs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setHandoffs((d?.candidates ?? []).filter((h) => h.domain === s.domain)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, lens, s.domain]);

  const nodes = lens?.nodes ?? lens?.chain ?? [];

  return (
    <details className="lsDrawer lsMemoryDrawer" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t("livingScene.memory.drawerTitle")}</summary>
      <div className="lsDrawerBody">
        {nodes.length ? (
          <ol className="lsMemoryChain">
            {nodes.slice(0, 6).map((n, i) => (
              <li key={n.id ?? i}>
                <span className={`lsMemTag lsMemTag-${n.type || "fact"}`}>{t(TAG_KEY[n.type] || TAG_KEY.fact)}</span>
                <span>{n.label ?? n.summary ?? n.text ?? ""}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="lsProvenance">{open ? t("livingScene.memory.noRecord") : ""}</p>
        )}
        {handoffs.length ? (
          <p className="lsMemoryHandoff">{t("livingScene.memory.handoffOffer", { amount: `SGD ${Math.round(handoffs[0].releasedMonthly || 0)}` })}</p>
        ) : null}
        <button type="button" className="linkButton" onClick={() => setActiveScreen?.("changeLedger")}>
          {t("livingScene.memory.openLedger")}
        </button>
      </div>
    </details>
  );
}
