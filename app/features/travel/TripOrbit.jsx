"use client";

// Trip Orbit - the Travel studio. A trip is a life window: date, people,
// comfort, budget. Moving any of them recomputes the cost, the payment
// nodes, and (when a branch costs less) the freed cashflow you place
// yourself. A budget ceiling below the real cost is not sealable.

import { useEffect, useState } from "react";
import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function TripOrbit({ t, setActiveScreen, language = "en" }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    fetch("/api/future-field?domain=travel")
      .then((r) => (r.ok ? r.json() : null))
      .then(setF)
      .catch(() => setF({ hasRealityPath: false }));
  }, []);

  const feas = f?.realityPath?.feasibility ?? null;

  return (
    <section className="screen wlpScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("tripOrbit.title")}</h1>
        <p>{t("tripOrbit.subtitle")}</p>
      </header>

      {feas && feas.available ? (
        <section className="wlpView">
          <h3>{t("tripOrbit.theWindow")}</h3>
          <dl className="wlpRiverInflow">
            <div><dt>{t("tripOrbit.tripCost")}</dt><dd>{sgd(feas.planTotal)}</dd></div>
            <div><dt>{t("tripOrbit.perTraveller")}</dt><dd>{feas.perTraveller ? sgd(feas.perTraveller) : "—"}</dd></div>
            <div><dt>{t("tripOrbit.monthlyNeeded")}</dt><dd>{feas.userRequiredMonthly != null ? `${sgd(feas.userRequiredMonthly)}/mo` : "—"}</dd></div>
            <div><dt>{t("tripOrbit.readyBy")}</dt><dd>{feas.readyMonth ?? "—"}</dd></div>
          </dl>
          {feas.budgetGap > 0 ? (
            <p className="wlpWarn">{t("tripOrbit.belowCost", { amount: sgd(feas.budgetGap) })}</p>
          ) : null}
          <p className="wlpProvenance">{t("tripOrbit.estimateNote")}</p>
        </section>
      ) : f && !f.hasRealityPath ? (
        <p className="wlpEmpty">{t("tripOrbit.noPlan")}</p>
      ) : null}

      {f?.hasRealityPath ? (
        <FutureFieldCanvas t={t} setActiveScreen={setActiveScreen} language={language} domain="travel" backTo="mirror" titleKey="tripOrbit.fieldTitle" subtitleKey="tripOrbit.fieldSubtitle" embedded />
      ) : null}
    </section>
  );
}
