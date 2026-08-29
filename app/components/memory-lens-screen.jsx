"use client";

// Memory Lens - "why is my <goal> like this now?" A single causal chain
// rebuilt from the real Change Ledger + plan versions. Every step is tagged
// Fact / Your choice / Estimate / Inference / Unknown. Where the record is
// thin it says so - no invented causality.

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

const GOALS = ["wedding", "home", "emergency", "retirement", "loan", "travel", "family", "investment"];

const NODE_CLASS = {
  fact: "mlFact",
  user_choice: "mlChoice",
  estimate: "mlEstimate",
  inference: "mlInference",
  unknown: "mlUnknown",
};

function fmtVal(v) {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("en-SG");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function MemoryLensScreen({ t, setActiveScreen, initialGoal = "wedding" }) {
  const [goal, setGoal] = useState(initialGoal);
  const [lens, setLens] = useState(null);
  const [error, setError] = useState("");
  const [openStep, setOpenStep] = useState(null);

  const load = useCallback(async (g) => {
    setLens(null);
    setError("");
    try {
      const res = await fetch(`/api/living-plan/memory-lens?goal=${encodeURIComponent(g)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(t("memoryLens.loadError"));
        return;
      }
      setLens(data);
    } catch {
      setError(t("memoryLens.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load(goal);
  }, [goal, load]);

  return (
    <section className="screen mlScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("lifeGraph")}>
        <ArrowLeft size={16} aria-hidden /> {t("changeLedger.back")}
      </button>
      <header className="mlHeader">
        <h1>{t("memoryLens.title")}</h1>
        <p>{t("memoryLens.subtitle")}</p>
      </header>

      <label className="mlGoalPick">
        {t("memoryLens.pickGoal")}
        <select value={goal} onChange={(e) => setGoal(e.target.value)}>
          {GOALS.map((g) => (
            <option key={g} value={g}>
              {t(`memoryLens.goal.${g}`) === `memoryLens.goal.${g}` ? g : t(`memoryLens.goal.${g}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="mlLegend">
        {["fact", "user_choice", "estimate", "inference"].map((k) => (
          <span key={k} className={NODE_CLASS[k]}>
            {t(`memoryLens.node.${k}`)}
          </span>
        ))}
      </div>

      {error ? <p className="mlEmpty">{error}</p> : null}
      {!lens ? <p className="mlMuted">…</p> : null}

      {lens && !lens.hasEnoughEvidence ? (
        <p className="mlEmpty">{t(lens.unknownReasonKey || "memoryLens.unknown.noRecord")}</p>
      ) : null}

      {lens && lens.hasEnoughEvidence ? (
        <ol className="mlChain">
          {lens.chain.map((s, i) => (
            <li key={s.eventId} className={`mlStep ${NODE_CLASS[s.nodeType] ?? ""}`}>
              <button type="button" className="mlStepHead" onClick={() => setOpenStep(openStep === i ? null : i)} aria-expanded={openStep === i}>
                <span className="mlWhen">{s.at ? new Date(s.at).toLocaleDateString() : "—"}</span>
                <span className="mlTag">{t(`memoryLens.node.${s.nodeType}`)}</span>
                <span className="mlWhat">{t(`changeLedger.actor.${s.actor}`)} · {s.actionType}</span>
              </button>
              {openStep === i ? (
                <div className="mlStepDetail">
                  {s.impacts.length ? (
                    <ul className="mlImpacts">
                      {s.impacts.map((im, k) => (
                        <li key={k}>
                          {im.goalId} · {im.metric}: {fmtVal(im.before)} → {fmtVal(im.after)} {im.unit ? im.unit : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mlMuted">{t("memoryLens.noImpact")}</p>
                  )}
                  {Object.keys(s.before).length ? (
                    <p className="mlMuted">{t("memoryLens.before")}: {fmtVal(s.before)}</p>
                  ) : null}
                  {Object.keys(s.after).length ? (
                    <p className="mlMuted">{t("memoryLens.after")}: {fmtVal(s.after)}</p>
                  ) : null}
                  {!s.evidenceKnown ? <p className="mlUnknownNote">{t("memoryLens.thinEvidence")}</p> : null}
                  {s.supersedesEventId ? <p className="mlMuted">{t("changeLedger.noLongerInEffect")}</p> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {lens && lens.versionTrail?.length ? (
        <details className="mlVersions">
          <summary>{t("memoryLens.versionTrail")}</summary>
          <ol>
            {lens.versionTrail.map((v) => (
              <li key={v.version}>
                v{v.version}
                {v.supersedesVersion ? ` ← v${v.supersedesVersion}` : ""} · {t(`memoryLens.node.${v.nodeType}`)} · {v.confidence ?? "—"}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <button type="button" className="linkButton" onClick={() => setActiveScreen("changeLedger")}>
        {t("changeLedger.viewFull")}
      </button>
    </section>
  );
}
