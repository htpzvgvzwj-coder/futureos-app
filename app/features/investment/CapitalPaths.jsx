"use client";

// Capital Paths - the Investment studio. Capital with a job: which future
// is this money working for, over what horizon. Moving the monthly
// commitment shows years-to-target (no return assumed - contributed amount
// only) vs the cashflow it costs now, and the readiness gate.

import { useEffect, useState } from "react";
import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

const READINESS_KEY = {
  readyToInvest: "capitalPaths.readiness.ready",
  buildBufferFirst: "capitalPaths.readiness.buffer",
  payDownDebtFirst: "capitalPaths.readiness.debt",
  noRoomYet: "capitalPaths.readiness.noRoom",
};

export function CapitalPaths({ t, setActiveScreen, language = "en" }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    fetch("/api/future-field?domain=investment")
      .then((r) => (r.ok ? r.json() : null))
      .then(setF)
      .catch(() => setF({ hasRealityPath: false }));
  }, []);

  const feas = f?.realityPath?.feasibility ?? null;

  return (
    <section className="screen wlpScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("capitalPaths.title")}</h1>
        <p>{t("capitalPaths.subtitle")}</p>
      </header>

      {feas && feas.available ? (
        <section className="wlpView">
          <h3>{t("capitalPaths.thisCapital")}</h3>
          <dl className="wlpRiverInflow">
            <div><dt>{t("capitalPaths.monthly")}</dt><dd>{sgd(feas.monthlyCommitment)}/mo</dd></div>
            <div><dt>{t("capitalPaths.horizon")}</dt><dd>{feas.horizonYears} {t("capitalPaths.years")}</dd></div>
            <div><dt>{t("capitalPaths.contributedBy")}</dt><dd>{sgd(feas.contributedByHorizon)}</dd></div>
            <div><dt>{t("capitalPaths.yearsToTarget")}</dt><dd>{feas.yearsToTarget != null ? `${feas.yearsToTarget} ${t("capitalPaths.years")}` : "—"}</dd></div>
          </dl>
          <p className={feas.hasEmergencyBuffer ? "wlpMuted" : "wlpWarn"}>
            {t(READINESS_KEY[feas.readiness] || "capitalPaths.readiness.ready", { months: feas.emergencyFundMonths })}
          </p>
          <p className="wlpProvenance">{t("capitalPaths.estimateNote")}</p>
        </section>
      ) : f && !f.hasRealityPath ? (
        <p className="wlpEmpty">{t("capitalPaths.noPlan")}</p>
      ) : null}

      {f?.hasRealityPath ? (
        <FutureFieldCanvas t={t} setActiveScreen={setActiveScreen} language={language} domain="investment" backTo="mirror" titleKey="capitalPaths.fieldTitle" subtitleKey="capitalPaths.fieldSubtitle" embedded />
      ) : null}
    </section>
  );
}
