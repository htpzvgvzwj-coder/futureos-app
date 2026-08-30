"use client";

// FutureLifeScene - the Retirement Studio's native surface.
//
// It does not open with "how much do you want at retirement". It opens with
// a Future Day: where you live, how much of your time is your own, whether
// you're caring for someone, which daily things you keep, how wide your
// life ranges. Each choice becomes a TRANSPARENT financial assumption
// (shown, not hidden) that moves your target monthly life - and the gap.
//
// The timeline then puts Now -> Wedding/Home -> Family -> Career flexibility
// -> Future Life on one draggable axis: pulling monthly room toward the
// near term compresses Future Life; pushing it forward releases it.

import { useMemo, useState } from "react";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";
import { DragTrack } from "../../components/living-scene/DragTrack.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const RETIREMENT_HORIZON_MONTHS = 25 * 12;

// The Future Day choices and their transparent monthly-target deltas.
export const FUTURE_DAY = {
  place: [
    { id: "city", delta: 300 },
    { id: "town", delta: 0 },
    { id: "lowerCost", delta: -400 },
  ],
  time: [
    { id: "fullStop", delta: 0 },
    { id: "partTime", delta: -600 },
    { id: "keepWorking", delta: -1200 },
  ],
  care: [
    { id: "caring", delta: 500 },
    { id: "notCaring", delta: 0 },
  ],
  radius: [
    { id: "local", delta: 0 },
    { id: "regional", delta: 200 },
    { id: "global", delta: 500 },
  ],
};
export const KEEP_DAILY = [
  { id: "diningOut", delta: 150 },
  { id: "car", delta: 400 },
  { id: "yearlyTravel", delta: 250 },
];

function targetFromChoices(baseTarget, choices) {
  let d = 0;
  for (const group of ["place", "time", "care", "radius"]) {
    const pick = choices[group];
    const opt = FUTURE_DAY[group].find((o) => o.id === pick);
    if (opt) d += opt.delta;
  }
  for (const k of choices.keep ?? []) {
    const opt = KEEP_DAILY.find((o) => o.id === k);
    if (opt) d += opt.delta;
  }
  return Math.max(0, Math.round(baseTarget + d));
}

// pure - mirrors retirementAdapter in lib/future-field/adapters.js
export function projectFutureLife({ branchVars, reality }) {
  const baseTarget = Number(reality.target_monthly_income) || 0;
  const baseGap = Number(reality.gap_monthly) || 0;
  const cpfLifeFixed = Math.max(0, baseTarget - baseGap); // held constant - stated assumption
  const choices = branchVars.futureDay ?? null;
  const targetAfter = choices ? targetFromChoices(baseTarget, choices) : baseTarget;
  const gapAfter = Math.max(0, targetAfter - cpfLifeFixed);

  const current = Number(reality.current_savings) || 0;
  const baseContribution = Number(reality.monthly_contribution) || 0;
  const contribution = Math.max(0, Math.round(Number(branchVars.monthly_contribution ?? baseContribution)));

  const nestBefore = Math.round(baseGap * RETIREMENT_HORIZON_MONTHS);
  const nestAfter = Math.round(gapAfter * RETIREMENT_HORIZON_MONTHS);
  const monthsBefore = baseContribution > 0 ? Math.ceil(Math.max(0, nestBefore - current) / baseContribution) : null;
  const monthsAfter = contribution > 0 ? Math.ceil(Math.max(0, nestAfter - current) / contribution) : null;
  const yearsBefore = monthsBefore != null ? Math.round((monthsBefore / 12) * 10) / 10 : null;
  const yearsAfter = monthsAfter != null ? Math.round((monthsAfter / 12) * 10) / 10 : null;

  const addedPressure = Math.max(0, contribution - baseContribution);
  const freedCashflow = Math.max(0, baseContribution - contribution);
  const dir = yearsAfter != null && yearsBefore != null ? (yearsAfter < yearsBefore ? "down" : yearsAfter > yearsBefore ? "up" : "flat") : "flat";

  const nodes = [
    { id: "futureLife", dir: yearsAfter != null && yearsBefore != null ? (yearsAfter < yearsBefore ? "up" : yearsAfter > yearsBefore ? "down" : "flat") : "flat", note: yearsAfter != null ? `${yearsAfter}y ${gapAfter > 0 ? "" : ""}` : "—" },
  ];
  if (addedPressure > 0) nodes.push({ id: "nearTerm", dir: "down" });
  if (freedCashflow > 0) nodes.push({ id: "nearTerm", dir: "up" });

  return {
    selfOutcome: { metric: "yearsToCloseGap", before: yearsBefore, after: yearsAfter, unit: "years", dir },
    nodes,
    freedCashflow,
    addedPressure,
    mode: addedPressure > 0 ? "pressure" : freedCashflow > 0 ? "freed" : "neutral",
    targetAfter,
    gapAfter,
    contribution,
    yearsAfter,
  };
}

// NOTE: a single low-contribution slider position is NOT a Decision Echo -
// it is one current trade-off. A real Echo needs >=3 similar user-confirmed
// Ledger actions and is surfaced from /api/living-plan/status, not from
// this scene. So this scene declares no synthetic turning point.

function yr(v) {
  return v == null ? "—" : `${v}y`;
}

function FutureLifeInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const [dayStep, setDayStep] = useState(0);
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;

  const headroom = useMemo(() => {
    const avail = Number(s.context?.availableMonthlyCashflow);
    const base = Number(reality?.monthly_contribution) || 0;
    return Math.max(base * 2, Number.isFinite(avail) && avail > 0 ? Math.round(avail / 10) * 10 : base * 2, 200);
  }, [s.context, reality]);

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("futureLifeTimeline.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("futureLifeTimeline.title")}</h1></header>
        <p className="wlpEmpty">{t("futureLifeTimeline.noPlan")}</p>
      </section>
    );
  }

  const choices = s.branchVars.futureDay ?? { place: "town", time: "fullStop", care: "notCaring", radius: "local", keep: [] };
  const setChoice = (group, id) => s.setVar("futureDay", { ...choices, [group]: id });
  const toggleKeep = (id) => {
    const has = (choices.keep ?? []).includes(id);
    s.setVar("futureDay", { ...choices, keep: has ? choices.keep.filter((k) => k !== id) : [...(choices.keep ?? []), id] });
  };
  const DAY_STEPS = ["place", "time", "care", "radius", "keep"];

  const baseContribution = Number(reality.monthly_contribution) || 0;
  const contribution = Math.max(0, Math.round(Number(s.branchVars.monthly_contribution ?? baseContribution)));
  const proj = s.projection?.yearsAfter != null ? s.projection : null;
  const targetAfter = proj?.targetAfter ?? feas.targetMonthlyIncome ?? 0;
  const gapAfter = proj?.gapAfter ?? feas.gapMonthly ?? 0;
  const yearsAfter = proj?.yearsAfter ?? feas.yearsToCloseGap;

  return (
    <section className="screen wlpScreen lsSceneScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("futureLifeTimeline.title")}</h1>
        <p>{t("futureLifeTimeline.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }]}
        realitySummary={t("futureLifeTimeline.summaryLine", { gap: `${sgd(feas.gapMonthly || 0)}/mo`, topup: `${sgd(baseContribution)}/mo` })}
        sealMonthlyAmount={contribution}
        formatSelf={yr}
        realityRows={[
          { id: "target", label: t("futureLifeTimeline.reality.target"), value: `${sgd(feas.targetMonthlyIncome || 0)}/mo`, provenance: t("futureLifeTimeline.reality.fromPlan") },
          { id: "gap", label: t("futureLifeTimeline.reality.gap"), value: `${sgd(feas.gapMonthly || 0)}/mo`, provenance: t("futureLifeTimeline.reality.cpfLife") },
          { id: "topup", label: t("futureLifeTimeline.reality.topup"), value: `${sgd(baseContribution)}/mo`, provenance: t("futureLifeTimeline.reality.fromPlan") },
        ]}
        realityNote={t("futureLifeTimeline.estimateNote")}
      >
        <div className="flScene">
          <div className="flDay">
            <h3>{t("futureLifeTimeline.futureDay")}</h3>
            <p className="flDayProgress">{t("futureLifeTimeline.dayStep", { n: Math.min(dayStep + 1, DAY_STEPS.length), of: DAY_STEPS.length })}</p>
            {(() => {
              const group = DAY_STEPS[Math.min(dayStep, DAY_STEPS.length - 1)];
              if (group === "keep") {
                return (
                  <div className="flDayGroup">
                    <span className="flDayLabel">{t("futureLifeTimeline.day.keep")}</span>
                    <div className="flDayOpts">
                      {KEEP_DAILY.map((o) => (
                        <button key={o.id} type="button" className={(choices.keep ?? []).includes(o.id) ? "is-on" : ""} onClick={() => toggleKeep(o.id)}>
                          {t(`futureLifeTimeline.day.keep.${o.id}`)}
                          <em>+{sgd(o.delta)}</em>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div className="flDayGroup">
                  <span className="flDayLabel">{t(`futureLifeTimeline.day.${group}`)}</span>
                  <div className="flDayOpts">
                    {FUTURE_DAY[group].map((o) => (
                      <button key={o.id} type="button" className={choices[group] === o.id ? "is-on" : ""} onClick={() => { setChoice(group, o.id); if (dayStep < DAY_STEPS.length - 1) setDayStep(dayStep + 1); }}>
                        {t(`futureLifeTimeline.day.${group}.${o.id}`)}
                        <em>{o.delta === 0 ? "±0" : o.delta > 0 ? `+${sgd(o.delta)}` : `−${sgd(-o.delta)}`}</em>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="flDayNav">
              {dayStep > 0 ? <button type="button" className="lsGhostBtn" onClick={() => setDayStep(dayStep - 1)}>{t("futureLifeTimeline.back")}</button> : null}
              {dayStep < DAY_STEPS.length - 1 ? <button type="button" className="lsGhostBtn" onClick={() => setDayStep(dayStep + 1)}>{t("futureLifeTimeline.skip")}</button> : null}
            </div>
            <p className="flAssumption">{t("futureLifeTimeline.assumption", { target: `${sgd(targetAfter)}/mo`, gap: `${sgd(gapAfter)}/mo` })}</p>
          </div>

          <div className="flTimeline">
            <h3>{t("futureLifeTimeline.axis")}</h3>
            <ol className="flStops" aria-hidden="true">
              <li>{t("futureLifeTimeline.stop.now")}</li>
              <li>{t("futureLifeTimeline.stop.weddingHome")}</li>
              <li>{t("futureLifeTimeline.stop.family")}</li>
              <li>{t("futureLifeTimeline.stop.career")}</li>
              <li className="is-future">{t("futureLifeTimeline.stop.futureLife")}</li>
            </ol>
            <DragTrack
              min={0}
              max={headroom}
              step={10}
              value={contribution}
              onChange={(v) => s.setVar("monthly_contribution", v)}
              ariaLabel={t("futureLifeTimeline.dragLabel")}
              poles={[t("futureLifeTimeline.pole.nearTerm"), t("futureLifeTimeline.pole.futureLife")]}
            />
            <p className="flReadout">
              {t("futureLifeTimeline.readout", { topup: `${sgd(contribution)}/mo`, years: yr(yearsAfter) })}
            </p>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function FutureLifeTimeline({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="retirement" projectFn={projectFutureLife} turningPointFor={null}>
      <FutureLifeInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
