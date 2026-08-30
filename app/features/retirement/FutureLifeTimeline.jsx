"use client";

// Future Life Timeline - the Retirement studio. Not a retirement number: a
// timeline where the near-term goals and the long-term life compete for the
// same monthly room. The customer moves the monthly top-up; the field
// shows years-to-close-the-gap vs the cashflow it costs.

import { useEffect, useState } from "react";
import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function FutureLifeTimeline({ t, setActiveScreen, language = "en" }) {
  const [f, setF] = useState(null);

  useEffect(() => {
    fetch("/api/future-field?domain=retirement")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setF(d))
      .catch(() => setF({ hasRealityPath: false }));
  }, []);

  const feas = f?.realityPath?.feasibility ?? null;

  return (
    <section className="screen wlpScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>
        ← {t("changeLedger.back")}
      </button>
      <header className="wlpHeader">
        <h1>{t("futureLifeTimeline.title")}</h1>
        <p>{t("futureLifeTimeline.subtitle")}</p>
      </header>

      {feas && feas.available ? (
        <section className="wlpView">
          <h3>{t("futureLifeTimeline.theGap")}</h3>
          <dl className="wlpRiverInflow">
            <div><dt>{t("futureLifeTimeline.monthlyGap")}</dt><dd>{sgd(feas.gapMonthly)}/mo</dd></div>
            <div><dt>{t("futureLifeTimeline.targetIncome")}</dt><dd>{feas.targetMonthlyIncome ? `${sgd(feas.targetMonthlyIncome)}/mo` : "—"}</dd></div>
            <div><dt>{t("futureLifeTimeline.monthlyTopUp")}</dt><dd>{sgd(feas.monthlyContribution)}/mo</dd></div>
            <div><dt>{t("futureLifeTimeline.closeGapIn")}</dt><dd>{feas.yearsToCloseGap != null ? t("futureLifeTimeline.years", { years: feas.yearsToCloseGap }) : "—"}</dd></div>
          </dl>
          <p className="wlpProvenance">{t("futureLifeTimeline.estimateNote")}</p>
        </section>
      ) : f && !f.hasRealityPath ? (
        <p className="wlpEmpty">{t("futureLifeTimeline.noPlan")}</p>
      ) : null}

      {f?.hasRealityPath ? (
        <FutureFieldCanvas
          t={t}
          setActiveScreen={setActiveScreen}
          language={language}
          domain="retirement"
          backTo="mirror"
          titleKey="futureLifeTimeline.fieldTitle"
          subtitleKey="futureLifeTimeline.fieldSubtitle"
          embedded
        />
      ) : null}
    </section>
  );
}
