"use client";

// Protection Envelope - the Insurance studio. Not a sales page. Around
// real life nodes (income, home loan, family, care) it shows which are
// protected, which have a gap, and which are simply Unknown - an unknown
// is never shown as a gap.

import { useEffect, useState } from "react";
import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const NODE_STATUS = { known: "peStatusKnown", partial: "peStatusPartial", unknown: "peStatusUnknown" };

export function ProtectionEnvelope({ t, setActiveScreen, language = "en" }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    fetch("/api/future-field?domain=insurance")
      .then((r) => (r.ok ? r.json() : null))
      .then(setF)
      .catch(() => setF({ hasRealityPath: false }));
  }, []);
  const feas = f?.realityPath?.feasibility ?? null;

  return (
    <section className="screen wlpScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("protectionEnvelope.title")}</h1>
        <p>{t("protectionEnvelope.subtitle")}</p>
      </header>

      {feas && feas.available ? (
        <section className="wlpView">
          <h3>{t("protectionEnvelope.whatIsCovered")}</h3>
          <ul className="peNodes">
            {feas.nodes.map((n) => (
              <li key={n.id} className={NODE_STATUS[n.status]}>
                <span>{t(`protectionEnvelope.node.${n.id}`)}</span>
                <b>
                  {n.status === "unknown"
                    ? t("protectionEnvelope.status.unknown")
                    : n.status === "partial"
                      ? t("protectionEnvelope.status.partial")
                      : n.gapAmount > 0
                        ? t("protectionEnvelope.gap", { amount: sgd(n.gapAmount) })
                        : t("protectionEnvelope.status.covered")}
                </b>
              </li>
            ))}
          </ul>
          <p className="wlpMuted">
            {t("protectionEnvelope.summary", { known: feas.knownGapCount, unknown: feas.unknownCount, premium: sgd(feas.premiumToCloseKnownGaps) })}
          </p>
          <p className="wlpProvenance">{t("protectionEnvelope.estimateNote")}</p>
        </section>
      ) : f && !f.hasRealityPath ? (
        <p className="wlpEmpty">{t("protectionEnvelope.noData")}</p>
      ) : null}

      {f?.hasRealityPath ? (
        <FutureFieldCanvas t={t} setActiveScreen={setActiveScreen} language={language} domain="insurance" backTo="mirror" titleKey="protectionEnvelope.fieldTitle" subtitleKey="protectionEnvelope.fieldSubtitle" embedded />
      ) : null}
    </section>
  );
}
