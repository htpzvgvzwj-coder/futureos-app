"use client";

// MemoryLayer - "Why did today turn out this way?"
//
// The causal chain for this Studio's goal, rebuilt from the real Change
// Ledger + plan versions (Memory Lens), plus - if a commitment here was
// later revoked - the Future Handoff offer to place its released monthly
// resource. Opens the full ledger for the rest.

import { useEffect, useState } from "react";
import { useLivingScene } from "./LivingSceneProvider.jsx";

const TAG_KEY = {
  fact: "livingScene.memory.tag.fact",
  user_choice: "livingScene.memory.tag.userChoice",
  estimate: "livingScene.memory.tag.estimate",
  inference: "livingScene.memory.tag.inference",
  unknown: "livingScene.memory.tag.unknown",
};

export function MemoryLayer({ t, setActiveScreen }) {
  const s = useLivingScene();
  const [lens, setLens] = useState(null);
  const [handoffs, setHandoffs] = useState([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/living-plan/memory-lens?goal=${encodeURIComponent(s.domain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setLens(d))
      .catch(() => {});
    fetch("/api/living-plan/handoffs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setHandoffs(d?.candidates ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.domain]);

  const nodes = lens?.nodes ?? lens?.chain ?? [];
  const mine = handoffs.filter((h) => h.domain === s.domain);

  return (
    <section className="lsLayer lsMemory" aria-label={t("livingScene.memory.title")}>
      <h3>{t("livingScene.memory.title")}</h3>

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
        <p className="lsProvenance">{t("livingScene.memory.noRecord")}</p>
      )}

      {mine.length ? (
        <p className="lsMemoryHandoff">{t("livingScene.memory.handoffOffer", { amount: `SGD ${Math.round(mine[0].releasedMonthly || 0)}` })}</p>
      ) : null}

      <button type="button" className="linkButton" onClick={() => setActiveScreen?.("changeLedger")}>
        {t("livingScene.memory.openLedger")}
      </button>
    </section>
  );
}
