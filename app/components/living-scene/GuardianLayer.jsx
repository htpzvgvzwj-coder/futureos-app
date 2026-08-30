"use client";

// GuardianLayer - "What is the system protecting?"
//
// Only after a seal. It rehearses a modest shock against the customer's
// sealed commitments (Shadow Guardian) and states plainly what Guardian
// will and will not do: it watches and notifies; it never moves money -
// there is no bank-transfer integration.

import { useEffect, useState } from "react";
import { useLivingScene } from "./LivingSceneProvider.jsx";

export function GuardianLayer({ t }) {
  const s = useLivingScene();
  const [preview, setPreview] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!s.sealState.sealed) return;
    let alive = true;
    fetch("/api/living-plan/shadow-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && (setPreview(d?.preview ?? null), setLoaded(true)))
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [s.sealState.sealed]);

  if (!s.sealState.sealed) return null;

  return (
    <section className="lsLayer lsGuardian" aria-label={t("livingScene.guardian.title")}>
      <h3>{t("livingScene.guardian.title")}</h3>
      <ul className="lsGuardianRules">
        <li>{t("livingScene.guardian.watches")}</li>
        <li>{t("livingScene.guardian.notifies")}</li>
        <li>{t("livingScene.guardian.neverMoves")}</li>
      </ul>
      {loaded ? (
        preview?.needsAChoice ? (
          <p className="lsGuardianAlert">{t("livingScene.guardian.wouldNeedChoice")}</p>
        ) : (
          <p className="lsProvenance">{t("livingScene.guardian.rehearsedClear")}</p>
        )
      ) : (
        <p className="lsProvenance">{t("livingScene.guardian.rehearsing")}</p>
      )}
    </section>
  );
}
