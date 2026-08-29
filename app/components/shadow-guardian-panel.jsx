"use client";

// Shadow Guardian - a quiet entry, nothing more, until the customer opens
// it. Then it shows a rehearsal (findings + up to 3 rescues + assumptions),
// never a plan change and never a money move. Rendered on the Guardian
// screen.

import { useCallback, useState } from "react";

export function ShadowGuardianPanel({ t, setActiveScreen }) {
  const [preview, setPreview] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/living-plan/shadow-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setPreview(data.preview);
        setOpen(true);
      }
    } catch {
      /* silent - Shadow Guardian never nags */
    } finally {
      setLoading(false);
    }
  }, []);

  if (dismissed) return null;

  if (!open) {
    return (
      <section className="sgEntry">
        <button type="button" className="linkButton" onClick={run} disabled={loading}>
          {t("shadowGuardian.entryPrompt")}
        </button>
      </section>
    );
  }

  if (!preview) return null;
  const f = preview.findings ?? {};

  return (
    <section className="sgPanel" aria-labelledby="sgTitle">
      <h3 id="sgTitle">{t("shadowGuardian.title")}</h3>
      <p className={preview.needsAChoice ? "sgLede sgWarn" : "sgLede"}>
        {t(preview.entryKey || (preview.needsAChoice ? "shadowGuardian.entry.needsAChoice" : "shadowGuardian.entry.allClear"))}
      </p>

      {preview.needsAChoice ? (
        <ul className="sgFindings">
          {f.cashflowWouldGoNegative ? (
            <li className="sgWarn">
              {t("shadowGuardian.finding.cashflow", { before: Math.round(f.freeCashflowBefore), after: Math.round(f.freeCashflowAfter) })}
            </li>
          ) : null}
          {f.floorWouldBreak ? (
            <li className="sgWarn">
              {t("shadowGuardian.finding.floor", { before: f.emergencyBufferBefore, after: f.emergencyBufferAfter, floor: f.emergencyFloorMonths })}
            </li>
          ) : null}
          {f.milestoneWouldMiss ? <li className="sgWarn">{t("shadowGuardian.finding.milestone")}</li> : null}
        </ul>
      ) : null}

      {preview.rescues?.length ? (
        <div className="sgRescues">
          <span className="sgRescuesLabel">{t("shadowGuardian.rescuesLabel")}</span>
          <ul>
            {preview.rescues.map((r, i) => (
              <li key={i}>{t(`shadowGuardian.rescue.${r.key}`)}</li>
            ))}
          </ul>
          <button type="button" className="secondaryButton" onClick={() => setActiveScreen("mirror")}>
            {t("shadowGuardian.openMirror")}
          </button>
        </div>
      ) : null}

      <details className="sgAssumptions">
        <summary>{t("shadowGuardian.assumptionsLabel", { level: preview.confidence })}</summary>
        <ul>
          {(preview.assumptions ?? []).map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </details>

      <button type="button" className="linkButton" onClick={() => setDismissed(true)}>
        {t("shadowGuardian.dismiss")}
      </button>
    </section>
  );
}
