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
