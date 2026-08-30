"use client";

// CapitalPathsScene - the Investment Studio's native surface.
//
// No "readiness score + generic canvas". Every dollar of available monthly
// capital must be given a job first: Safety, Wedding, Home, Flexible,
// Retirement, Long-term Capital. Moving capital toward a future produces a
// POSSIBLE allocation - with its liquidity, time and (stated) opportunity
// cost - which only becomes real on Seal. No trade is ever executed. The
// Liquidity Gate sets how long the money must stay available, so near-term
// and long-term goals visibly pull against each other.

import { useMemo } from "react";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";
import { DragTrack } from "../../components/living-scene/DragTrack.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export const CAPITAL_JOBS = [
  { id: "safety", liquid: true },
  { id: "wedding", liquid: true },
  { id: "home", liquid: true },
  { id: "flexible", liquid: true },
  { id: "retirement", liquid: false },
  { id: "longTerm", liquid: false },
];

function capitalPool(reality, context) {
  const a = Number(context?.availableMonthlyCashflow);
  if (Number.isFinite(a) && a > 0) return Math.round(a / 10) * 10;
  const inc = Number(reality.monthly_income) || 0;
  const exp = Number(reality.monthly_expenses) || 0;
  return Math.max(100, Math.round((inc - exp) / 10) * 10);
}

function defaultJobs(reality, pool) {
  const invest = Math.min(pool, Number(reality.monthly_commitment) || 0);
  return { safety: 0, wedding: 0, home: 0, flexible: Math.max(0, pool - invest), retirement: 0, longTerm: invest };
}

// pure - mirrors investmentAdapter (no investment return assumed)
export function projectCapital({ branchVars, reality, context }) {
  const pool = capitalPool(reality, context);
  const jobs = branchVars.jobs ?? defaultJobs(reality, pool);
  const baseHorizon = Number(reality.horizon_years) || 10;
  const horizon = Math.max(1, Math.round(Number(branchVars.horizon_years ?? baseHorizon)));
  const baseCommitment = Number(reality.monthly_commitment) || 0;
  const commitment = Math.max(0, Math.round((jobs.retirement || 0) + (jobs.longTerm || 0)));

  const current = Number(reality.current_savings) || 0;
  const targetPool = Number(reality.target_pool) || Math.round(baseCommitment * baseHorizon * 12) || Math.round(commitment * horizon * 12);
  const shortfall = Math.max(0, targetPool - current);
  const monthsBefore = baseCommitment > 0 ? Math.ceil(shortfall / baseCommitment) : null;
  const monthsAfter = commitment > 0 ? Math.ceil(shortfall / commitment) : null;
  const yearsBefore = monthsBefore != null ? Math.round((monthsBefore / 12) * 10) / 10 : null;
  const yearsAfter = monthsAfter != null ? Math.round((monthsAfter / 12) * 10) / 10 : null;

  const liquidKept = CAPITAL_JOBS.filter((j) => j.liquid).reduce((sum, j) => sum + (Number(jobs[j.id]) || 0), 0);
  const assigned = CAPITAL_JOBS.reduce((sum, j) => sum + (Number(jobs[j.id]) || 0), 0);

  const addedPressure = Math.max(0, commitment - baseCommitment);
  const freedCashflow = Math.max(0, baseCommitment - commitment);
  const dir = yearsAfter != null && yearsBefore != null ? (yearsAfter < yearsBefore ? "down" : yearsAfter > yearsBefore ? "up" : "flat") : "flat";

  const nodes = [
    { id: "liquidity", dir: "flat", note: `${sgd(liquidKept)}/mo` },
  ];
  if (addedPressure > 0) nodes.push({ id: "flexible", dir: "down" });
  if (freedCashflow > 0) nodes.push({ id: "flexible", dir: "up" });

  return {
    selfOutcome: { metric: "yearsToTarget", before: yearsBefore, after: yearsAfter, unit: "years", dir },
    nodes,
    freedCashflow,
    addedPressure,
    mode: addedPressure > 0 ? "pressure" : freedCashflow > 0 ? "freed" : "neutral",
    pool,
    assigned,
    unassigned: Math.max(0, pool - assigned),
    over: assigned > pool + 0.5,
    liquidKept,
    commitment,
    horizon,
    yearsAfter,
  };
}

function capitalEcho({ branchVars, reality, context }) {
  const pool = capitalPool(reality, context);
  const jobs = branchVars.jobs;
  if (!jobs) return null;
  const liquid = CAPITAL_JOBS.filter((j) => j.liquid).reduce((s, j) => s + (Number(jobs[j.id]) || 0), 0);
  if (pool > 0 && liquid / pool >= 0.7) {
    return { id: "inv-liquidity", whyNowKey: "capitalPaths.echo.liquidity", ifYouWaitKey: "capitalPaths.echo.liquidityWait" };
  }
  return null;
}

function yr(v) {
  return v == null ? "—" : `${v}y`;
}

function CapitalPathsInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;

  const pool = useMemo(() => (reality ? capitalPool(reality, s.context) : 1000), [reality, s.context]);

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("capitalPaths.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("capitalPaths.title")}</h1></header>
        <p className="wlpEmpty">{t("capitalPaths.noPlan")}</p>
      </section>
    );
  }

  const jobs = s.branchVars.jobs ?? defaultJobs(reality, pool);
  const baseHorizon = Number(reality.horizon_years) || 10;
  const horizon = Math.max(1, Math.round(Number(s.branchVars.horizon_years ?? baseHorizon)));
  const proj = s.projection?.yearsAfter !== undefined ? s.projection : null;
  const unassigned = proj?.unassigned ?? pool;
  const over = proj?.over ?? false;
  const liquidKept = proj?.liquidKept ?? pool;
  const commitment = proj?.commitment ?? (Number(reality.monthly_commitment) || 0);

  const setJob = (id, v) => {
    const next = { ...jobs, [id]: Math.max(0, Math.round(v)) };
    s.setVar("jobs", next);
  };

  return (
    <section className="screen wlpScreen lsSceneScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("capitalPaths.title")}</h1>
        <p>{t("capitalPaths.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalLabel={t("livingScene.node.home")}
        sealMonthlyAmount={commitment}
        sealDisabled={over}
        formatSelf={yr}
        realityRows={[
          { id: "pool", label: t("capitalPaths.reality.pool"), value: `${sgd(pool)}/mo`, provenance: t("capitalPaths.reality.fromCashflow") },
          { id: "invest", label: t("capitalPaths.reality.investing"), value: `${sgd(feas.monthlyCommitment)}/mo`, provenance: t("capitalPaths.reality.fromPlan") },
          { id: "readiness", label: t("capitalPaths.reality.readiness"), value: t(`capitalPaths.readiness.${feas.readiness === "readyToInvest" ? "ready" : feas.readiness === "buildBufferFirst" ? "buffer" : feas.readiness === "payDownDebtFirst" ? "debt" : "noRoom"}`, { months: feas.emergencyFundMonths }), provenance: t("capitalPaths.reality.gate") },
        ]}
        realityNote={t("capitalPaths.estimateNote")}
      >
        <div className="cpScene">
          <p className={over ? "cpPoolOver" : "cpPool"}>
            {over ? t("capitalPaths.over", { amount: sgd((proj?.assigned ?? 0) - pool) }) : t("capitalPaths.unassigned", { amount: sgd(unassigned) })}
          </p>

          <div className="cpJobs">
            {CAPITAL_JOBS.map((j) => (
              <label key={j.id} className={`cpJob ${j.liquid ? "is-liquid" : "is-locked"}`}>
                <span>
                  {t(`capitalPaths.job.${j.id}`)}
                  <em>{j.liquid ? t("capitalPaths.liquid") : t("capitalPaths.locked")}</em>
                </span>
                <DragTrack min={0} max={Math.max(pool, 1)} step={10} value={Math.min(Number(jobs[j.id]) || 0, pool)} onChange={(v) => setJob(j.id, v)} ariaLabel={t(`capitalPaths.job.${j.id}`)} />
                <b>{sgd(jobs[j.id] || 0)}</b>
              </label>
            ))}
          </div>

          <label className="cpGate">
            <span>{t("capitalPaths.liquidityGate")}</span>
            <DragTrack min={1} max={30} step={1} value={horizon} onChange={(v) => s.setVar("horizon_years", v)} ariaLabel={t("capitalPaths.liquidityGate")} poles={[t("capitalPaths.gate.soon"), t("capitalPaths.gate.longterm")]} />
            <b>{t("capitalPaths.years", { n: horizon })}</b>
          </label>

          <p className="wlpMuted">{t("capitalPaths.possibleAllocation", { liquid: sgd(liquidKept), invest: sgd(commitment) })}</p>
          <p className="wlpProvenance">{t("capitalPaths.noReturnNote")}</p>
        </div>
      </SceneShell>
    </section>
  );
}

export function CapitalPaths({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="investment" projectFn={projectCapital} turningPointFor={capitalEcho}>
      <CapitalPathsInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
