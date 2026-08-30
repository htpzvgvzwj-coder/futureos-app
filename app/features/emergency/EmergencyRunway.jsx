"use client";

// Safety Runway - the Emergency Studio's flagship native scene.
//
// Not "how many months have you saved". A runway of essential months, with
// the customer's real commitments as loads along it, and a Guardian Rail at
// the floor. Drag the runway end to change the target; pick which
// commitments to keep alive; and ONLY on an explicit "Rehearse a shock" is
// an income gap ever applied - and even then the real plan is untouched.
//
// Numbers from lib/emergency/runway-finance.js; the cross-goal impactSet
// from /api/emergency-runway.

import { useEffect, useMemo, useState } from "react";
import { computeSafetyRunway, rehearseShock, requiredRebuildForTarget } from "../../../lib/emergency/runway-finance.js";
import { projectRunwayImpact } from "../../../lib/emergency/runway-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const EM_VARS = ["target_months", "floor_months", "monthly_contribution", "protected_commitments", "essential_share"];
function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of EM_VARS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}

function runwayCtxFrom(reality, sceneContext) {
  return {
    monthlyExpenses: { value: Number(reality.monthly_expenses) || 0, provenance: reality.monthly_expenses != null ? "user_confirmed" : "unknown" },
    liquidAssets: { value: reality.current_savings != null ? Number(reality.current_savings) : null, provenance: reality.current_savings != null ? "bank_confirmed" : "unknown" },
    essentialShare: reality.essential_share,
    commitments: sceneContext?.runwayCommitments ?? [],
  };
}

// pure projectFn for LivingSceneProvider - instant, shares the engine.
export function projectEmergency({ branchVars, reality, context }) {
  const b = merged(reality, branchVars);
  const ctx = runwayCtxFrom(reality, context);
  const rf = computeSafetyRunway({ planData: reality, context: ctx });
  const bf = computeSafetyRunway({ planData: b, context: ctx });
  if (!rf.available || !bf.available) return {};
  const impact = projectRunwayImpact({ branchData: b, realityData: reality, context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "monthsToFloor", before: rf.monthsToFloor, after: bf.monthsToFloor, unit: "months", dir: (bf.monthsToFloor ?? 0) < (rf.monthsToFloor ?? 0) ? "down" : (bf.monthsToFloor ?? 0) > (rf.monthsToFloor ?? 0) ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    runway: bf,
    impactSet: impact,
  };
}

function emergencyTurningPoint({ projection }) {
  const r = projection?.runway;
  if (!r?.available) return null;
  if (r.currentRunwayMonths != null && r.currentRunwayMonths < r.floorMonths) {
    return { id: "runway-below-floor", whyNowKey: "emergencyRunway.tp.belowFloor", whyNowParams: { months: r.currentRunwayMonths, floor: r.floorMonths } };
  }
  return null;
}

// ---------- SVG runway ----------
const RW_W = 320;
const RW_H = 120;
const MAX_MONTHS = 18;
function mToX(m) {
  return 8 + (Math.min(MAX_MONTHS, Math.max(0, m)) / MAX_MONTHS) * (RW_W - 16);
}

function RunwayField({ t, targetMonths, floorMonths, currentRunway, protectedRunway, liquidKnown, survivability, onTarget }) {
  const railX = mToX(floorMonths);
  const curX = currentRunway != null ? mToX(currentRunway) : null;
  const protX = protectedRunway != null ? mToX(protectedRunway) : null;
  const endX = mToX(targetMonths);

  return (
    <svg
      className="rwField"
      viewBox={`0 0 ${RW_W} ${RW_H}`}
      role="group"
      aria-label={t("emergencyRunway.field.label")}
    >
      {/* runway strip */}
      <rect x="8" y="40" width={RW_W - 16} height="30" className="rwStrip" />
      {Array.from({ length: MAX_MONTHS }).map((_, i) => (
        <line key={i} x1={mToX(i + 1)} y1="40" x2={mToX(i + 1)} y2="70" className="rwSeg" />
      ))}

      {/* fog beyond known data */}
      {!liquidKnown ? <rect x="8" y="40" width={RW_W - 16} height="30" className="rwFog" /> : null}

      {/* Guardian Rail at the floor */}
      <line x1={railX} y1="26" x2={railX} y2="84" className={`rwRail ${currentRunway != null && currentRunway < floorMonths ? "is-crossed" : ""}`} />
      <text x={railX + 3} y="22" className="rwRailLabel">{t("emergencyRunway.field.rail", { months: floorMonths })}</text>

      {/* current + protected runway markers */}
      {curX != null ? <><line x1={curX} y1="34" x2={curX} y2="76" className="rwCurrent" /><text x={curX} y="94" className="rwMarkerLabel" textAnchor="middle">{t("emergencyRunway.field.now", { months: currentRunway })}</text></> : null}
      {protX != null && protX !== curX ? <line x1={protX} y1="38" x2={protX} y2="72" className="rwProtected" /> : null}

      {/* commitment loads */}
      {(survivability ?? []).slice(0, 6).map((c, i) => (
        c.monthsSustainable != null ? (
          <circle key={c.id ?? i} cx={mToX(c.monthsSustainable)} cy={55} r={c.essential ? 5 : 3.5} className={`rwLoad ${c.essential ? "is-essential" : ""}`}>
            <title>{c.label} · {sgd(c.monthlyAmount)}/mo</title>
          </circle>
        ) : null
      ))}

      {/* draggable runway END (target) */}
      <g
        className="rwEnd"
        role="slider"
        tabIndex={0}
        aria-label={t("emergencyRunway.field.target", { months: targetMonths })}
        aria-valuemin={1}
        aria-valuemax={MAX_MONTHS}
        aria-valuenow={targetMonths}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onTarget(Math.min(MAX_MONTHS, targetMonths + 1));
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onTarget(Math.max(1, targetMonths - 1));
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * RW_W;
          onTarget(Math.max(1, Math.min(MAX_MONTHS, Math.round(((x - 8) / (RW_W - 16)) * MAX_MONTHS))));
        }}
      >
        <line x1={endX} y1="30" x2={endX} y2="80" className="rwEndLine" />
        <polygon points={`${endX},30 ${endX + 8},38 ${endX},46`} className="rwEndFlag" />
      </g>
    </svg>
  );
}

function EmergencyRunwayInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [server, setServer] = useState(null);
  const [rehearseOpen, setRehearseOpen] = useState(false);
  const [gap, setGap] = useState(3);
  const [expense, setExpense] = useState(0);
  const [rehearsal, setRehearsal] = useState(null);

  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/emergency-runway${bid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setServer(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.serverBranch?.id]);

  const commitments = server?.reality?.runway?.commitments ?? [];
  const sceneCtx = useMemo(() => ({ ...s.context, runwayCommitments: commitments }), [s.context, commitments]);
  const m = useMemo(() => (reality ? merged(reality, s.branchVars) : null), [reality, s.branchVars]);
  const proj = s.projection?.runway?.available ? s.projection : null;
  const runway = proj?.runway ?? (m ? computeSafetyRunway({ planData: m, context: runwayCtxFrom(m, sceneCtx) }) : null);

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("emergencyRunway.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !m || !runway?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("emergencyRunway.title")}</h1></header>
        <p className="wlpEmpty">{t("emergencyRunway.noData")}</p>
      </section>
    );
  }

  const targetMonths = Number(m.target_months) || runway.targetMonths;
  const floorMonths = Number(m.floor_months) || runway.floorMonths;
  const rebuild = Number(m.monthly_contribution) || 0;
  const setTarget = (v) => s.setVar("target_months", Math.max(1, Math.round(v)));
  const setRebuild = (v) => s.setVar("monthly_contribution", Math.max(0, Math.round(v / 10) * 10));
  const suggestedRebuild = requiredRebuildForTarget({ runway, targetMonths, byMonths: 24 });

  const runRehearsal = () => {
    setRehearsal(
      rehearseShock({
        runway,
        shock: { incomeInterruptionMonths: gap, temporaryMonthlyExpense: expense, incomeRecoveryRatio: 1, monthlyIncome: Number(s.context?.monthlyIncome) || Number(reality.monthly_income) || 0 },
      }),
    );
  };

  return (
    <section className="screen wlpScreen lsSceneScreen rwScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("emergencyRunway.title")}</h1>
        <p>{t("emergencyRunway.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "retirement" }]}
        realitySummary={t("emergencyRunway.summaryLine", { months: runway.currentRunwayMonths ?? "—", floor: floorMonths })}
        sealMonthlyAmount={rebuild || suggestedRebuild || 0}
        formatSelf={(v) => (v == null ? "—" : t("emergencyRunway.months", { n: v }))}
        realityRows={[
          { id: "runway", label: t("emergencyRunway.row.current"), value: runway.currentRunwayMonths != null ? t("emergencyRunway.months", { n: runway.currentRunwayMonths }) : t("emergencyRunway.fog"), provenance: t("emergencyRunway.prov.liquid") },
          { id: "essential", label: t("emergencyRunway.row.burn"), value: `${sgd(runway.essentialBurn.value)}/mo`, provenance: t(`emergencyRunway.prov.${runway.essentialShare.provenance}`) },
          { id: "rebuild", label: t("emergencyRunway.row.rebuild"), value: `${sgd(rebuild)}/mo`, provenance: t("emergencyRunway.prov.you") },
          { id: "toFloor", label: t("emergencyRunway.row.toFloor"), value: runway.monthsToFloor != null ? t("emergencyRunway.months", { n: runway.monthsToFloor }) : "—", provenance: t("emergencyRunway.prov.rebuildMath") },
        ]}
        realityUnknowns={(server?.unknowns ?? runway.unknowns ?? []).map((u) => ({ id: u, label: t(`emergencyRunway.unknown.${u}`) }))}
        realityNote={t("emergencyRunway.estimateNote")}
      >
        <div className="rwSurface">
          <RunwayField
            t={t}
            targetMonths={targetMonths}
            floorMonths={floorMonths}
            currentRunway={runway.currentRunwayMonths}
            protectedRunway={runway.protectedRunwayMonths}
            liquidKnown={runway.liquidAssets.value != null}
            survivability={runway.survivability}
            onTarget={setTarget}
          />

          {runway.quietZone ? (
            <p className="rwQuiet">{t("emergencyRunway.quietZone")}</p>
          ) : (
            <div className="rwRebuild">
              <label>
                <span>{t("emergencyRunway.rebuildLabel")}</span>
                <input type="range" min="0" max={Math.max(2000, (suggestedRebuild || 500) * 2)} step="10" value={rebuild} onChange={(e) => setRebuild(Number(e.target.value))} aria-label={t("emergencyRunway.rebuildLabel")} />
                <b>{sgd(rebuild)}/mo</b>
              </label>
              {suggestedRebuild != null ? (
                <button type="button" className="lsGhostBtn" onClick={() => setRebuild(suggestedRebuild)}>
                  {t("emergencyRunway.useSuggested", { amount: sgd(suggestedRebuild) })}
                </button>
              ) : null}
            </div>
          )}

          <div className="rwSteppers">
            <div className="toStepper">
              <button type="button" onClick={() => setTarget(targetMonths - 1)} aria-label={t("emergencyRunway.shorter")}>−</button>
              <b>{t("emergencyRunway.targetLabel", { n: targetMonths })}</b>
              <button type="button" onClick={() => setTarget(targetMonths + 1)} aria-label={t("emergencyRunway.longer")}>+</button>
            </div>
          </div>

          {/* Commitment Survivability */}
          <div className="rwSurvive">
            <p className="rwSurviveHead">{t("emergencyRunway.survivability")}</p>
            <ul>
              {(runway.survivability ?? []).slice(0, 6).map((c) => (
                <li key={c.id} className={c.monthsSustainable != null && c.monthsSustainable < floorMonths ? "is-risk" : ""}>
                  <span>{c.label}{c.essential ? ` · ${t("emergencyRunway.essential")}` : ""}</span>
                  <b>{c.monthsSustainable != null ? t("emergencyRunway.months", { n: c.monthsSustainable }) : t("emergencyRunway.fog")}</b>
                </li>
              ))}
            </ul>
          </div>

          {/* Shock rehearsal - only on explicit request */}
          <button type="button" className="lsGhostBtn rwRehearseBtn" aria-expanded={rehearseOpen} onClick={() => setRehearseOpen((o) => !o)}>
            {t("emergencyRunway.rehearseOpen")}
          </button>
          {rehearseOpen ? (
            <div className="rwRehearse">
              <p className="lsProvenance">{t("emergencyRunway.rehearseNote")}</p>
              <label>{t("emergencyRunway.gapMonths")}<input type="number" min="0" max="12" value={gap} onChange={(e) => setGap(Number(e.target.value) || 0)} /></label>
              <label>{t("emergencyRunway.tempExpense")}<input type="number" min="0" step="50" value={expense} onChange={(e) => setExpense(Number(e.target.value) || 0)} /></label>
              <button type="button" className="lsPrimaryBtn" onClick={runRehearsal}>{t("emergencyRunway.runRehearsal")}</button>
              {rehearsal ? (
                <div className={`rwRehearsalResult rwVerdict-${rehearsal.verdict}`}>
                  <p><b>{t(`emergencyRunway.verdict.${rehearsal.verdict}`)}</b></p>
                  {rehearsal.floorBreachMonth != null ? <p>{t("emergencyRunway.breachAt", { m: rehearsal.floorBreachMonth })}</p> : null}
                  {rehearsal.recoveryGradientMonths != null ? <p>{t("emergencyRunway.recoveryGradient", { m: rehearsal.recoveryGradientMonths })}</p> : null}
                  <ul className="rwSurvivors">
                    {rehearsal.survivedCommitments.slice(0, 6).map((c) => (
                      <li key={c.id} className={c.survivesGap ? "" : "is-risk"}>{c.label}: {c.survivesGap ? t("emergencyRunway.survives") : t("emergencyRunway.atRisk")}</li>
                    ))}
                  </ul>
                  <p className="lsProvenance">{rehearsal.note}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rpMirror">
            <button type="button" onClick={() => setTarget(6)}>{t("emergencyRunway.mirror.sixMonths")}</button>
            <button type="button" onClick={() => setTarget(Math.max(3, floorMonths))}>{t("emergencyRunway.mirror.floorOnly")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("emergencyRunway.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function EmergencyRunway({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="emergency" projectFn={projectEmergency} turningPointFor={emergencyTurningPoint}>
      <EmergencyRunwayInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
