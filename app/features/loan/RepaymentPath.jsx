"use client";

// Repayment Path - the Loan studio. Debt is a weight on monthly freedom,
// not a repayment table. The customer moves the extra monthly repayment;
// the field shows months-to-debt-free vs the cashflow it costs, and (when a
// branch pays LESS) the freed cashflow becomes an Available Future.

import { useEffect, useState } from "react";
import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function RepaymentPath({ t, setActiveScreen, language = "en" }) {
  const [f, setF] = useState(null);

  useEffect(() => {
    fetch("/api/future-field?domain=loan")
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
        <h1>{t("repaymentPath.title")}</h1>
        <p>{t("repaymentPath.subtitle")}</p>
      </header>

      {feas && feas.available ? (
        <section className="wlpView">
          <h3>{t("repaymentPath.weightVsFreedom")}</h3>
          <dl className="wlpRiverInflow">
            <div><dt>{t("repaymentPath.debtWeight")}</dt><dd>{feas.debtWeight != null ? `${Math.round(feas.debtWeight * 100)}%` : "—"}</dd></div>
            <div><dt>{t("repaymentPath.monthlyFreedom")}</dt><dd>{feas.monthlyFreedom != null ? `${sgd(feas.monthlyFreedom)}/mo` : "—"}</dd></div>
            <div><dt>{t("repaymentPath.debtFreeIn")}</dt><dd>{feas.monthsToDebtFree != null ? t("repaymentPath.months", { months: feas.monthsToDebtFree }) : "—"}</dd></div>
            <div><dt>{t("repaymentPath.futureScore")}</dt><dd>{feas.futureScore ?? "—"}</dd></div>
          </dl>
          <p className="wlpProvenance">{t("repaymentPath.estimateNote")}</p>
        </section>
      ) : f && !f.hasRealityPath ? (
        <p className="wlpEmpty">{t("repaymentPath.noLoan")}</p>
      ) : null}

      {f?.hasRealityPath ? (
        <FutureFieldCanvas
          t={t}
          setActiveScreen={setActiveScreen}
          language={language}
          domain="loan"
          backTo="mirror"
          titleKey="repaymentPath.fieldTitle"
          subtitleKey="repaymentPath.fieldSubtitle"
          embedded
        />
      ) : null}
    </section>
  );
}
