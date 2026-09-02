"use client";

// Future-Day Loom - the Retirement Studio's flagship native scene.
//
// It does NOT open with a retirement number. Phase 1 builds a Future Day
// one question at a time; Phase 2 is the Loom - a pullable Now/Future Seam
// that trades current freedom for future life, an Open Future Band showing
// what the customer can still choose (not just a gap), and every figure a
// RANGE with a stated, dated assumption. No return is assumed in the base;
// no inheritance / unconfirmed partner assets are ever counted.

import { useEffect, useMemo, useState } from "react";
import { computeFutureLoom, FUTURE_DAY_QUESTIONS } from "../../../lib/retirement/future-day-finance.js";
import { projectFutureDayImpact } from "../../../lib/retirement/future-day-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
function range(r) {
  return r ? `${sgd(r.low)}–${sgd(r.high)}` : "—";
}

function loomPlanFrom(reality, branchVars) {
  return {
    future_day: branchVars.future_day ?? reality.future_day ?? {},
    future_age: branchVars.future_age ?? reality.future_age ?? null,
    current_age: reality.current_age ?? null,
    monthly_contribution: Number(branchVars.monthly_contribution ?? reality.monthly_contribution) || 0,
    inflation_assumption: branchVars.inflation_assumption ?? reality.inflation_assumption ?? null,
    longevity_years: branchVars.longevity_years ?? reality.longevity_years ?? 25,
    minimum_current_breathing_room: Number(branchVars.minimum_current_breathing_room) || 0,
  };
}
function loomCtxFrom(reality, sceneContext) {
  const cpfLife = Number(reality.target_monthly_income) - Number(reality.gap_monthly);
  return {
    monthlyIncome: Number(reality.monthly_income) || 0,
    monthlyExpenses: Number(reality.monthly_expenses) || 0,
    otherGoalsMonthlyOutflow: Number(sceneContext?.committedMonthlyTotal) || 0,
    cpfLifeMonthly: Number.isFinite(cpfLife) && cpfLife > 0 ? cpfLife : null,
    existingRetirementAssets: sceneContext?.existingRetirementAssets ?? null,
    emergencyBufferMonths: sceneContext?.emergencyBufferMonths ?? null,
  };
}

export function projectRetirementLoom({ branchVars, reality, context }) {
  const ctx = loomCtxFrom(reality, context);
  const rf = computeFutureLoom({ planData: loomPlanFrom(reality, {}), context: ctx });
  const bf = computeFutureLoom({ planData: loomPlanFrom(reality, branchVars), context: ctx });
  if (!rf.available || !bf.available) return {};
  const impact = projectFutureDayImpact({ branchPlan: loomPlanFrom(reality, branchVars), realityPlan: loomPlanFrom(reality, {}), context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "emergency" ? `${sgd(g.possibleAfter)}/mo room` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "gapMonthly", before: rf.gapMonthlyRange.expected, after: bf.gapMonthlyRange.expected, unit: "sgd", dir: bf.gapMonthlyRange.expected < rf.gapMonthlyRange.expected ? "down" : bf.gapMonthlyRange.expected > rf.gapMonthlyRange.expected ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    loom: bf,
    impactSet: impact,
  };
}

function loomTurningPoint({ projection }) {
  const l = projection?.loom;
  if (!l?.available) return null;
  if (l.liquidityConflict) return { id: "loom-liquidity", whyNowKey: "futureDayLoom.tp.liquidityConflict", ifYouWaitKey: "futureDayLoom.tp.liquidityConflictWait" };
  if (l.belowBreathing) return { id: "loom-below-breathing", whyNowKey: "futureDayLoom.tp.belowBreathing" };
  return null;
}

// ---------- SVG loom ----------
const LM_W = 320;
const LM_H = 120;

function LoomField({ t, seamPos, openBand, futureAge, onSeam, onAge }) {
  const seamX = 20 + seamPos * (LM_W - 40); // 0 = all "now", 1 = all "future"
  return (
    <svg className="lmField" viewBox={`0 0 ${LM_W} ${LM_H}`} role="group" aria-label={t("futureDayLoom.field.label")}>
      {/* the thread */}
      <line x1="20" y1="50" x2={LM_W - 20} y2="50" className="lmThread" />
      <circle cx="20" cy="50" r="6" className="lmNow" />
      <text x="20" y="70" className="lmSmall" textAnchor="middle">{t("futureDayLoom.field.now")}</text>
      <circle cx={LM_W - 20} cy="50" r="6" className="lmFuture" />
      <text x={LM_W - 20} y="70" className="lmSmall" textAnchor="middle">{t("futureDayLoom.field.future")}</text>

      {/* Now/Future Seam - pullable */}
      <g
        className="lmSeam"
        role="slider"
        tabIndex={0}
        aria-label={t("futureDayLoom.field.seam")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(seamPos * 100)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onSeam(Math.max(0, seamPos - 0.05));
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") onSeam(Math.min(1, seamPos + 0.05));
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * LM_W;
          onSeam(Math.max(0, Math.min(1, (x - 20) / (LM_W - 40))));
        }}
      >
        <line x1={seamX} y1="30" x2={seamX} y2="70" className="lmSeamLine" />
        <circle cx={seamX} cy="50" r="9" className="lmSeamKnot" />
      </g>

      {/* Open Future Band */}
      <rect x="20" y="86" width={LM_W - 40} height="8" className="lmBandTrack" />
      <rect x="20" y="86" width={Math.max(0, Math.min(1, openBand)) * (LM_W - 40)} height="8" className="lmBandFill" />
      <text x="20" y="106" className="lmSmall">{t("futureDayLoom.field.openBand", { pct: Math.round(openBand * 100) })}</text>

      {/* future age handle */}
      <g
        className="lmAge"
        role="slider"
        tabIndex={0}
        aria-label={t("futureDayLoom.field.age", { age: futureAge })}
        aria-valuemin={50}
        aria-valuemax={80}
        aria-valuenow={futureAge}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onAge(Math.max(50, futureAge - 1));
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") onAge(Math.min(80, futureAge + 1));
          else return;
          e.preventDefault();
        }}
      >
        <text x={LM_W - 20} y="16" className="lmAgeLabel" textAnchor="end">{t("futureDayLoom.field.retireAt", { age: futureAge })}</text>
      </g>
    </svg>
  );
}

function FutureDayLoomInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [step, setStep] = useState(0); // 0..N-1 questions, then N = loom
  const [server, setServer] = useState(null);

  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/future-day-loom${bid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setServer(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.serverBranch?.id]);

  const choices = s.branchVars.future_day ?? {};
  const setChoice = (qid, oid) => {
    s.setVar("future_day", { ...choices, [qid]: oid });
    if (step < FUTURE_DAY_QUESTIONS.length) setStep((x) => x + 1);
  };
  const setSupported = (n) => s.setVar("future_day", { ...choices, supported_people: Math.max(0, n) });

  const loom = useMemo(
    () => (reality ? computeFutureLoom({ planData: loomPlanFrom(reality, s.branchVars), context: loomCtxFrom(reality, s.context) }) : null),
    [reality, s.branchVars, s.context],
  );
  const proj = s.projection?.loom?.available ? s.projection.loom : loom;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("futureDayLoom.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !proj?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("futureDayLoom.title")}</h1></header>
        <p className="wlpEmpty">{t("futureDayLoom.noPlan")}</p>
      </section>
    );
  }

  const inQuestions = step < FUTURE_DAY_QUESTIONS.length;
  const contribution = Number(s.branchVars.monthly_contribution ?? reality.monthly_contribution) || 0;
  const futureAge = Number(s.branchVars.future_age ?? reality.future_age) || proj.futureAge;
  const requiredExpected = proj.requiredContributionRange.expected;
  const seamPos = requiredExpected > 0 ? Math.min(1, contribution / Math.max(requiredExpected * 1.5, 1)) : 0;

  const setSeam = (pos) => {
    const target = Math.round((pos * Math.max(requiredExpected * 1.5, 1)) / 10) * 10;
    s.setVar("monthly_contribution", Math.max(0, target));
  };
  const setAge = (age) => s.setVar("future_age", age);

  return (
    <section className="screen wlpScreen lsSceneScreen lmScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("futureDayLoom.title")}</h1>
        <p>{t("futureDayLoom.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }]}
        realitySummary={t("futureDayLoom.summaryLine", { gap: range(proj.gapMonthlyRange), contribution: `${sgd(contribution)}/mo` })}
        sealMonthlyAmount={contribution || requiredExpected}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "target", label: t("futureDayLoom.row.target"), value: range(proj.targetMonthlyRange), provenance: t("futureDayLoom.prov.range") },
          { id: "confirmed", label: t("futureDayLoom.row.confirmedIncome"), value: proj.confirmedMonthlyIncome.value != null ? `${sgd(proj.confirmedMonthlyIncome.value)}/mo` : t("futureDayLoom.unknown.cpf_life_monthly"), provenance: t(`futureDayLoom.prov.${proj.confirmedMonthlyIncome.provenance}`) },
          { id: "gap", label: t("futureDayLoom.row.gap"), value: `${range(proj.gapMonthlyRange)}/mo`, provenance: t("futureDayLoom.prov.range") },
          { id: "need", label: t("futureDayLoom.row.needContribution"), value: `${range(proj.requiredContributionRange)}/mo`, provenance: t("futureDayLoom.prov.noReturn") },
        ]}
        realityUnknowns={(server?.unknowns ?? proj.unknowns ?? []).map((u) => ({ id: u, label: t(`futureDayLoom.unknown.${u}`) }))}
        realityNote={t("futureDayLoom.estimateNote")}
      >
        <div className="lmSurface">
          {inQuestions ? (
            <div className="lmQuestion">
              <p className="lmStep">{t("futureDayLoom.step", { n: step + 1, of: FUTURE_DAY_QUESTIONS.length })}</p>
              <h3>{t(`futureDayLoom.q.${FUTURE_DAY_QUESTIONS[step].id}`)}</h3>
              <div className="lmOptions">
                {FUTURE_DAY_QUESTIONS[step].options.map((o) => (
                  <button key={o.id} type="button" className={choices[FUTURE_DAY_QUESTIONS[step].id] === o.id ? "is-on" : ""} onClick={() => setChoice(FUTURE_DAY_QUESTIONS[step].id, o.id)}>
                    {t(`futureDayLoom.q.${FUTURE_DAY_QUESTIONS[step].id}.${o.id}`)}
                    <em>{o.monthlyDelta === 0 ? "±0" : o.monthlyDelta > 0 ? `+${sgd(o.monthlyDelta)}` : `−${sgd(-o.monthlyDelta)}`}</em>
                  </button>
                ))}
              </div>
              <div className="lmQNav">
                {step > 0 ? <button type="button" className="lsGhostBtn" onClick={() => setStep(step - 1)}>{t("futureDayLoom.back")}</button> : null}
                <button type="button" className="lsGhostBtn" onClick={() => setStep(FUTURE_DAY_QUESTIONS.length)}>{t("futureDayLoom.skipToLoom")}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="lmFutureDay">
                <h3>{t("futureDayLoom.yourFutureDay")}</h3>
                <ul className="lmDayParts">
                  {proj.futureDay.contributions.map((c, i) => (
                    <li key={i}>
                      {t(`futureDayLoom.q.${c.question}${c.choice && FUTURE_DAY_QUESTIONS.find((q) => q.id === c.question) ? "." + c.choice : ""}`)}
                      <b>{c.monthlyDelta > 0 ? "+" : ""}{sgd(c.monthlyDelta)}/mo</b>
                    </li>
                  ))}
                  {proj.futureDay.contributions.length === 0 ? <li>{t("futureDayLoom.dayBaselineOnly")}</li> : null}
                </ul>
                <label className="lmSupported">
                  <span>{t("futureDayLoom.supportedPeople")}</span>
                  <div className="toStepper">
                    <button type="button" onClick={() => setSupported((choices.supported_people || 0) - 1)} aria-label={t("futureDayLoom.fewer")}>−</button>
                    <b>{choices.supported_people || 0}</b>
                    <button type="button" onClick={() => setSupported((choices.supported_people || 0) + 1)} aria-label={t("futureDayLoom.more")}>+</button>
                  </div>
                </label>
                <button type="button" className="lsGhostBtn" onClick={() => setStep(0)}>{t("futureDayLoom.editDay")}</button>
              </div>

              <LoomField t={t} seamPos={seamPos} openBand={proj.openFutureBand} futureAge={futureAge} onSeam={setSeam} onAge={setAge} />

              <p className="lmReadout">
                {t("futureDayLoom.readout", { contribution: `${sgd(contribution)}/mo`, band: `${Math.round(proj.openFutureBand * 100)}%` })}
              </p>
              {proj.optimisticContribution ? (
                <p className="lsProvenance">{t("futureDayLoom.withReturn", { amount: sgd(proj.optimisticContribution.expected), pct: proj.optimisticContribution.assumptionPercent })} — {proj.optimisticContribution.note}</p>
              ) : null}
              {server?.projection?.decisionEcho ? (
                <p className="lmEcho">{t("futureDayLoom.decisionEcho")}</p>
              ) : null}

              <div className="rpMirror">
                <button type="button" onClick={() => setSeam(seamPos + 0.15)}>{t("futureDayLoom.mirror.moreFuture")}</button>
                <button type="button" onClick={() => setSeam(seamPos - 0.15)}>{t("futureDayLoom.mirror.moreNow")}</button>
                <button type="button" onClick={() => s.resetBranch()}>{t("futureDayLoom.mirror.reset")}</button>
              </div>
            </>
          )}
        </div>
      </SceneShell>
    </section>
  );
}

export function FutureDayLoom({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="retirement" projectFn={projectRetirementLoom} turningPointFor={loomTurningPoint}>
      <FutureDayLoomInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
