"use client";

// Wedding Living Plan - the flagship Future Bank vertical.
//
// One wedding state object (useWeddingField) seen through several lenses:
//   Field   - the Future Field canvas (time, branches, Pin, Seal, Catch-up)
//   Guests  - Guest Orbit
//   Budget  - Budget River
//   Compare - Wedding Mirror (<=3 branches on what actually differs)
//   History - visual Change Replay
//
// Life Graph = the Evidence / Why lines shown inline. Mirror = the Compare
// lens. Guardian = the in-place execution state after Seal (no jump to a
// separate screen). History = Change Replay.

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";
import { useWeddingField } from "./useWeddingField.js";
import { GuestOrbit } from "./GuestOrbit.jsx";
import { BudgetRiver } from "./BudgetRiver.jsx";
import { WeddingMirror } from "./WeddingMirror.jsx";
import { WeddingChangeReplay } from "./WeddingChangeReplay.jsx";
import { ReleasedFuture } from "./ReleasedFuture.jsx";

const VIEWS = ["field", "guests", "budget", "compare", "history"];

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function WeddingLivingPlan({ t, setActiveScreen, language = "en" }) {
  const { field, error, busy, reload, call, peel } = useWeddingField();
  const [view, setView] = useState("field");
  const [sealed, setSealed] = useState(null);
  // Single source of truth for which branch is selected - shared by the
  // Future Field canvas AND the Released Future panel below it.
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const selectedBranch = useMemo(
    () => (field?.possiblePaths ?? []).find((b) => b.id === selectedBranchId) ?? null,
    [field, selectedBranchId],
  );

  if (field && field.hasRealityPath === false) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>
          <ArrowLeft size={16} aria-hidden /> {t("changeLedger.back")}
        </button>
        <header className="wlpHeader">
          <h1>{t("weddingLivingPlan.title")}</h1>
        </header>
        <p className="wlpEmpty">{t("futureField.noRealityPathWedding")}</p>
        <button type="button" className="primaryButton" onClick={() => setActiveScreen("needWedding")}>
          {t("futureField.goConfirmPlanWedding")}
        </button>
      </section>
    );
  }

  const active = field?.state === "scheduled" || sealed;
  const reality = field?.realityPath?.feasibility ?? {};

  return (
    <section className="screen wlpScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>
        <ArrowLeft size={16} aria-hidden /> {t("changeLedger.back")}
      </button>
      <header className="wlpHeader">
        <h1>{t("weddingLivingPlan.title")}</h1>
        <p>{t("weddingLivingPlan.subtitle")}</p>
      </header>

      {/* In-place Guardian state after Seal - not a separate screen */}
      {active ? (
        <section className="wlpGuardian" role="status">
          <strong>{t("weddingLivingPlan.guardian.active")}</strong>
          <p className="wlpMuted">{t("weddingLivingPlan.guardian.detail")}</p>
        </section>
      ) : reality.sealable === false ? (
        <section className="wlpNeedsChanges" role="status">
          <strong>{t("weddingLivingPlan.needsChanges.title")}</strong>
          <p className="wlpMuted">
            {t("weddingLivingPlan.needsChanges.detail", {
              gap: sgd(reality.budgetGap ?? 0),
              core: sgd(reality.computedCoreTotal ?? 0),
            })}
          </p>
        </section>
      ) : null}

      <nav className="wlpTabs" aria-label={t("weddingLivingPlan.title")}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? "wlpTab wlpTabActive" : "wlpTab"}
            aria-current={view === v}
            onClick={() => setView(v)}
          >
            {t(`weddingLivingPlan.tab.${v}`)}
          </button>
        ))}
      </nav>

      {error && !field ? <p className="wlpEmpty">{t("futureField.loadError")}</p> : null}
      {!field ? <p className="wlpMuted">…</p> : null}

      {field ? (
        <div className="wlpBody">
          {view === "field" ? (
            <>
              <FutureFieldCanvas
                t={t}
                setActiveScreen={setActiveScreen}
                language={language}
                domain="wedding"
                backTo="mirror"
                titleKey="weddingLivingPlan.fieldTitle"
                subtitleKey="weddingLivingPlan.fieldSubtitle"
                embedded
                externalField={field}
                externalError={error}
                externalBusy={busy}
                externalReload={reload}
                selectedBranchId={selectedBranchId}
                setSelectedBranchId={setSelectedBranchId}
              />
              <ReleasedFuture selectedBranch={selectedBranch} t={t} call={call} reload={reload} busy={busy} />
            </>
          ) : null}
          {view === "guests" ? <GuestOrbit field={field} t={t} peel={peel} busy={busy} /> : null}
          {view === "budget" ? <BudgetRiver field={field} t={t} peel={peel} busy={busy} /> : null}
          {view === "compare" ? (
            <WeddingMirror
              field={field}
              t={t}
              call={call}
              reload={reload}
              busy={busy}
              onSealed={(d) => setSealed(d)}
            />
          ) : null}
          {view === "history" ? <WeddingChangeReplay t={t} setActiveScreen={setActiveScreen} /> : null}
        </div>
      ) : null}
    </section>
  );
}
