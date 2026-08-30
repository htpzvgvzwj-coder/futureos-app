"use client";

// Family Constellation - the Family studio. A shared future with
// boundaries: the agreed shared contribution and its split are visible;
// each partner's private affordability and balances never are. Changes to
// the shared contribution or a Must-Keep item need both partners.

import { useEffect, useState } from "react";
import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function FamilyConstellation({ t, setActiveScreen, language = "en" }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    fetch("/api/future-field?domain=family")
      .then((r) => (r.ok ? r.json() : null))
      .then(setF)
      .catch(() => setF({ hasRealityPath: false }));
  }, []);
  const feas = f?.realityPath?.feasibility ?? null;
  const bm = feas?.blindMerge ?? null;

  return (
    <section className="screen wlpScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("familyConstellation.title")}</h1>
        <p>{t("familyConstellation.subtitle")}</p>
      </header>

      {feas && feas.available ? (
        <section className="wlpView">
          <h3>{t("familyConstellation.theShared")}</h3>
          <dl className="wlpRiverInflow">
            <div><dt>{t("familyConstellation.sharedMonthly")}</dt><dd>{sgd(feas.sharedMonthlyContribution)}/mo</dd></div>
            <div><dt>{t("familyConstellation.yourShare")}</dt><dd>{sgd(feas.partnerAShare)}/mo</dd></div>
            <div><dt>{t("familyConstellation.partnerShare")}</dt><dd>{sgd(feas.partnerBShare)}/mo</dd></div>
            <div><dt>{t("familyConstellation.committed")}</dt><dd>{sgd(feas.committedMonthly)}/mo</dd></div>
          </dl>
          {bm ? (
            <p className={bm.feasibleBandExists ? "wlpMuted" : "wlpWarn"}>
              {bm.feasibleBandExists
                ? t("familyConstellation.jointBand", { low: sgd(bm.jointBand.low), high: sgd(bm.jointBand.high) })
                : t("familyConstellation.noBand")}
              {bm.conflicts.length ? ` · ${t("familyConstellation.conflicts", { count: bm.conflicts.length })}` : ""}
            </p>
          ) : (
            <p className="wlpMuted">{t("familyConstellation.blindMergePrompt")}</p>
          )}
          {feas.bothConfirmedRequired ? <p className="wlpWarn">{t("familyConstellation.bothConfirm")}</p> : null}
          <p className="wlpProvenance">{t("familyConstellation.privacyNote")}</p>
        </section>
      ) : f && !f.hasRealityPath ? (
        <p className="wlpEmpty">{t("familyConstellation.noData")}</p>
      ) : null}

      {f?.hasRealityPath ? (
        <FutureFieldCanvas t={t} setActiveScreen={setActiveScreen} language={language} domain="family" backTo="mirror" titleKey="familyConstellation.fieldTitle" subtitleKey="familyConstellation.fieldSubtitle" embedded />
      ) : null}
    </section>
  );
}
