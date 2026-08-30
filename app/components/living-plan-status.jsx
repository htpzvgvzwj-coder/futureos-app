"use client";

// Today status line - Promise Weight (one calm word), the next Turning
// Point, and any Decision Echo. No fear, no red panic, no urgency copy.
// Data: GET /api/living-plan/status (all computed from real sealed
// commitments + real cashflow + the Change Ledger).

import { useCallback, useEffect, useState } from "react";

const STATUS_CLASS = { calm: "lpsCalm", tightening: "lpsTightening", needs_a_decision: "lpsDecision" };

export function LivingPlanStatus({ t, setActiveScreen }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [echoHidden, setEchoHidden] = useState(false);

  const load = useCallback(() => {
    fetch("/api/living-plan/status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dismissEcho = async (pattern) => {
    setEchoHidden(true);
    try {
      await fetch("/api/living-plan/echo/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern }),
      });
    } catch {
      /* dismissed locally regardless */
    }
  };

  if (failed || !data) return null;
  const pw = data.promiseWeight;
  if (!pw || pw.activeCommitmentCount === 0) return null;

  return (
    <section className={`lpsCard ${STATUS_CLASS[pw.status] ?? ""}`} aria-label={t("promiseWeight.title")}>
      <div className="lpsRow">
        <span className="lpsChip">{t(`promiseWeight.status.${pw.status}`)}</span>
        <span className="lpsCount">{t("promiseWeight.commitments", { count: pw.activeCommitmentCount })}</span>
      </div>
      {pw.pressureWindow ? (
        <p className="lpsLine">
          {t("promiseWeight.pressureWindow", {
            month: pw.pressureWindow.month,
            count: pw.pressureWindow.driverCommitments.length,
          })}
        </p>
      ) : (
        <p className="lpsLine">{t(pw.headlineKey)}</p>
      )}
      {data.nextTurningPoint ? (
        <button
          type="button"
          className="lpsTurning"
          onClick={() => setActiveScreen && setActiveScreen("mirror")}
        >
          {t(data.nextTurningPoint.whyNowKey, data.nextTurningPoint.whyNowParams)}
          <small>{t(`turningPoint.state.${data.nextTurningPoint.state}`)}</small>
        </button>
      ) : null}
      {data.decisionEchoes?.length && !echoHidden ? (
        <div className="lpsEcho">
          <p>
            {t(data.decisionEchoes[0].promptKey)} <em>({t("decisionEcho.confidence", { level: data.decisionEchoes[0].confidence })})</em>
          </p>
          <div className="lpsEchoActions">
            <button type="button" className="linkButton" onClick={() => dismissEcho(data.decisionEchoes[0].pattern)}>
              {t("decisionEcho.dismiss")}
            </button>
            <button type="button" className="linkButton" onClick={() => setActiveScreen && setActiveScreen("changeLedger")}>
              {t("decisionEcho.askWhy")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// Guardian "Needs your decision" - only the things that actually need the
// customer to decide, confirm, or handle. Pulls the next Turning Point
// from the same real status endpoint.
export function GuardianDecisions({ t, setActiveScreen }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/living-plan/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const tp = data?.nextTurningPoint ?? null;
  const counts = data?.turningPointCounts ?? { open: 0, approaching: 0 };
  if (!tp && counts.open === 0 && counts.approaching === 0) {
    return (
      <section className="gdCard gdClear" role="status">
        <strong>{t("guardianDecisions.clear")}</strong>
      </section>
    );
  }

  return (
    <section className="gdCard" role="status" aria-label={t("guardianDecisions.label")}>
      <span className="gdChip">{t(`turningPoint.state.${tp?.state ?? "open"}`)}</span>
      {tp ? (
        <>
          <p className="gdWhy">{t(tp.whyNowKey, tp.whyNowParams)}</p>
          <p className="gdWait">{t(tp.ifYouWaitKey)}</p>
        </>
      ) : null}
      {counts.approaching > 0 ? (
        <p className="gdMore">{t("guardianDecisions.more", { count: counts.approaching })}</p>
      ) : null}
      <button type="button" className="linkButton" onClick={() => setActiveScreen && setActiveScreen("mirror")}>
        {t("guardianDecisions.review")}
      </button>
    </section>
  );
}
