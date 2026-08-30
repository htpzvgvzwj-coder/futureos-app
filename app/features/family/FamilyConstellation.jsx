"use client";

// FamilyConstellationScene - the Family Studio's native surface.
//
// People, shared goals and responsibilities are nodes; the links between
// them carry one of three permissions - Shared / Visible but private /
// Private. The core interaction is a full Blind Merge:
//   1. each partner privately marks every shared goal Must Keep / Flexible
//      / Undecided, and privately enters an affordable range
//   2. neither side's raw numbers are shared
//   3. only the overlapping feasible band is returned
//   4. conflict points are shown
//   5. each partner confirms separately
//   6. only after both confirm is there a shared commitment
// Until both confirm, every downstream effect on Home / Insurance /
// Retirement is Possible, never applied.

import { useMemo, useState } from "react";
import { computeFamilyConstellation, blindMerge } from "../../../lib/family/constellation-finance.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";
import { DragTrack } from "../../components/living-scene/DragTrack.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const MARKS = ["mustKeep", "flexible", "undecided"];

function viewFromMarks(marks, min, max) {
  const v = { affordableMin: min, affordableMax: max, mustKeep: [], flexible: [], undecided: [] };
  for (const [id, m] of Object.entries(marks || {})) {
    if (m === "mustKeep") v.mustKeep.push(id);
    else if (m === "flexible") v.flexible.push(id);
    else if (m === "undecided") v.undecided.push(id);
  }
  return v;
}

// pure - shares computeFamilyConstellation with lib/future-field/adapters.js
export function projectFamily({ branchVars, reality }) {
  const items = branchVars.items ?? (Array.isArray(reality.items) ? reality.items : []);
  const before = Number(reality.shared_monthly_contribution) || 0;
  const after = Math.max(0, Math.round(Number(branchVars.shared_monthly_contribution ?? before)));
  const ratio = Number(branchVars.partner_share_ratio ?? reality.partner_share_ratio ?? 0.5);

  const merged = {
    shared_monthly_contribution: after,
    partner_share_ratio: ratio,
    items,
    partnerA_view: branchVars.aConfirmed && branchVars.aView ? branchVars.aView : null,
    partnerB_view: branchVars.bConfirmed && branchVars.bView ? branchVars.bView : null,
  };
  const rf = computeFamilyConstellation({ planData: { ...reality, items } });
  const bf = computeFamilyConstellation({ planData: merged });
  const bothConfirmed = Boolean(branchVars.aConfirmed && branchVars.bConfirmed);

  const freedCashflow = bothConfirmed ? Math.max(0, before - after) : 0;
  const addedPressure = bothConfirmed ? Math.max(0, after - before) : 0;
  const dir = after < before ? "down" : after > before ? "up" : "flat";

  const nodes = ["home", "insurance", "retirement"].map((id) => ({
    id,
    dir: bothConfirmed ? (freedCashflow > 0 ? "up" : addedPressure > 0 ? "down" : "flat") : "flat",
    note: bothConfirmed ? undefined : "possible",
  }));

  return {
    selfOutcome: { metric: "sharedContribution", before, after, unit: "sgd_per_month", dir },
    nodes,
    freedCashflow,
    addedPressure,
    mode: addedPressure > 0 ? "pressure" : freedCashflow > 0 ? "freed" : "neutral",
    constellation: bf,
    reality: rf,
    bothConfirmed,
    sealable: bf.sealable && bothConfirmed,
  };
}

function FamilyConstellationInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [step, setStep] = useState("A"); // A | B | band | confirm
  const [aMarks, setAMarks] = useState({});
  const [aMin, setAMin] = useState(0);
  const [aMax, setAMax] = useState(0);
  const [bMarks, setBMarks] = useState({});
  const [bMin, setBMin] = useState(0);
  const [bMax, setBMax] = useState(0);

  const items = useMemo(
    () => s.branchVars.items ?? (Array.isArray(reality?.items) ? reality.items : []),
    [s.branchVars.items, reality],
  );

  const preview = useMemo(() => {
    if (!items.length) return null;
    return blindMerge({
      partnerA: viewFromMarks(aMarks, aMin, aMax),
      partnerB: viewFromMarks(bMarks, bMin, bMax),
      sharedItems: items,
    });
  }, [items, aMarks, aMin, aMax, bMarks, bMin, bMax]);

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("familyConstellation.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("familyConstellation.title")}</h1></header>
        <p className="wlpEmpty">{t("familyConstellation.noData")}</p>
      </section>
    );
  }

  const shared = Math.max(0, Math.round(Number(s.branchVars.shared_monthly_contribution ?? reality.shared_monthly_contribution ?? 0)));
  const ratio = Number(s.branchVars.partner_share_ratio ?? reality.partner_share_ratio ?? 0.5);
  const band = preview?.jointBand ?? null;
  const bothConfirmed = Boolean(s.branchVars.aConfirmed && s.branchVars.bConfirmed);

  const cycleMark = (side, id) => {
    const [marks, setMarks] = side === "A" ? [aMarks, setAMarks] : [bMarks, setBMarks];
    const cur = marks[id];
    const next = MARKS[(MARKS.indexOf(cur) + 1) % MARKS.length] ?? MARKS[0];
    setMarks({ ...marks, [id]: next });
  };

  const commitViews = () => {
    s.setVar("aView", viewFromMarks(aMarks, aMin, aMax));
    s.setVar("bView", viewFromMarks(bMarks, bMin, bMax));
  };

  return (
    <section className="screen wlpScreen lsSceneScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("familyConstellation.title")}</h1>
        <p>{t("familyConstellation.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "retirement" }, { id: "emergency" }]}
        realitySummary={t("familyConstellation.summaryLine", { shared: `${sgd(reality.shared_monthly_contribution || 0)}/mo`, items: items.length })}
        sealMonthlyAmount={shared}
        formatSelf={(v) => `${sgd(v)}/mo`}
        realityRows={[
          { id: "shared", label: t("familyConstellation.reality.shared"), value: `${sgd(reality.shared_monthly_contribution || 0)}/mo`, provenance: t("familyConstellation.reality.agreed") },
          { id: "split", label: t("familyConstellation.reality.split"), value: `${Math.round(ratio * 100)}% / ${Math.round((1 - ratio) * 100)}%`, provenance: t("familyConstellation.reality.agreed") },
          { id: "items", label: t("familyConstellation.reality.items"), value: String(items.length), provenance: t("familyConstellation.reality.sharedGoals") },
        ]}
        realityNote={t("familyConstellation.privacyNote")}
      >
        <div className="fcScene">
          {!items.length ? (
            <p className="wlpMuted">{t("familyConstellation.noItems")}</p>
          ) : (
            <>
              <ol className="fcSteps" aria-hidden="true">
                {["A", "B", "band", "confirm"].map((k) => (
                  <li key={k} className={step === k ? "is-now" : ""}>{t(`familyConstellation.step.${k}`)}</li>
                ))}
              </ol>

              {(step === "A" || step === "B") ? (
                <div className="fcPartner">
                  <h3>{t(`familyConstellation.partner.${step}`)}</h3>
                  <p className="wlpMuted">{t("familyConstellation.markHint")}</p>
                  <ul className="fcItems">
                    {items.map((it) => {
                      const mark = (step === "A" ? aMarks : bMarks)[it.id];
                      return (
                        <li key={it.id}>
                          <span>{it.id} · {sgd(it.monthlyCost)}/mo</span>
                          <button type="button" className={`fcMark fcMark-${mark || "none"}`} onClick={() => cycleMark(step, it.id)}>
                            {t(`familyConstellation.mark.${mark || "none"}`)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <label className="fcRange">
                    <span>{t("familyConstellation.privateRange")}</span>
                    <input type="number" inputMode="numeric" placeholder={t("familyConstellation.min")} value={step === "A" ? aMin || "" : bMin || ""} onChange={(e) => (step === "A" ? setAMin : setBMin)(Number(e.target.value) || 0)} />
                    <input type="number" inputMode="numeric" placeholder={t("familyConstellation.max")} value={step === "A" ? aMax || "" : bMax || ""} onChange={(e) => (step === "A" ? setAMax : setBMax)(Number(e.target.value) || 0)} />
                    <span className="fcPrivate">{t("familyConstellation.staysPrivate")}</span>
                  </label>
                  <button type="button" className="lsSpinePrimary" onClick={() => setStep(step === "A" ? "B" : "band")}>
                    {t("familyConstellation.next")}
                  </button>
                </div>
              ) : null}

              {step === "band" ? (
                <div className="fcBand">
                  <h3>{t("familyConstellation.bandTitle")}</h3>
                  {preview?.feasibleBandExists ? (
                    <p className="fcBandRange">{t("familyConstellation.jointBand", { low: sgd(band.low), high: sgd(band.high) })}</p>
                  ) : (
                    <p className="wlpWarn">{t("familyConstellation.noBand")}</p>
                  )}
                  {preview?.conflicts?.length ? (
                    <ul className="fcConflicts">
                      {preview.conflicts.map((c, i) => (
                        <li key={i}>{c.kind === "undecided" ? t("familyConstellation.conflictUndecided", { item: c.itemId }) : t("familyConstellation.conflictMustFlex", { item: c.itemId, side: c.mustKeepSide })}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="wlpMuted">{t("familyConstellation.noConflicts")}</p>
                  )}
                  {preview?.feasibleBandExists ? (
                    <label className="fcSlider">
                      <span>{t("familyConstellation.chooseWithinBand")}</span>
                      <DragTrack min={band.low} max={band.high} step={10} value={Math.min(Math.max(shared || band.low, band.low), band.high)} onChange={(v) => s.setVar("shared_monthly_contribution", v)} ariaLabel={t("familyConstellation.chooseWithinBand")} />
                      <b>{sgd(shared || band.low)}/mo</b>
                    </label>
                  ) : null}
                  <button type="button" className="lsSpinePrimary" onClick={() => { commitViews(); setStep("confirm"); }}>{t("familyConstellation.toConfirm")}</button>
                </div>
              ) : null}

              {step === "confirm" ? (
                <div className="fcConfirm">
                  <h3>{t("familyConstellation.confirmTitle")}</h3>
                  <label><input type="checkbox" checked={Boolean(s.branchVars.aConfirmed)} onChange={(e) => s.setVar("aConfirmed", e.target.checked)} /> {t("familyConstellation.partnerAConfirms")}</label>
                  <label><input type="checkbox" checked={Boolean(s.branchVars.bConfirmed)} onChange={(e) => s.setVar("bConfirmed", e.target.checked)} /> {t("familyConstellation.partnerBConfirms")}</label>
                  <label className="fcSlider">
                    <span>{t("familyConstellation.splitRatio")}</span>
                    <DragTrack min={0} max={100} step={5} value={Math.round(ratio * 100)} onChange={(v) => s.setVar("partner_share_ratio", v / 100)} ariaLabel={t("familyConstellation.splitRatio")} />
                    <b>{Math.round(ratio * 100)}% / {Math.round((1 - ratio) * 100)}%</b>
                  </label>
                  <p className={bothConfirmed ? "wlpMuted" : "wlpWarn"}>
                    {bothConfirmed ? t("familyConstellation.bothConfirmedOk") : t("familyConstellation.needsBoth")}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </SceneShell>
    </section>
  );
}

export function FamilyConstellation({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="family" projectFn={projectFamily}>
      <FamilyConstellationInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
