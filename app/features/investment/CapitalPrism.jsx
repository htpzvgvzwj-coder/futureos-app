"use client";

// Capital Prism - the Investment Studio's flagship native scene.
//
// One beam of monthly capital enters the prism and splits into six
// spectral bands, each a JOB for the money. Drag a SEAM between two
// adjacent bands to move capital from one job to the next - a pure
// transfer, total capital conserved. Drag the Liquidity Gate line to set
// how many years the money must stay reachable. Every move re-runs the
// real readiness gate and a years-to-target with NO return assumed, plus
// a SERVER-owned cross-goal impactSet. No trade is ever executed here.

import { useEffect, useMemo, useState } from "react";
import { computeCapitalPrism, PRISM_BANDS } from "../../../lib/investment/capital-prism-finance.js";
import { projectCapitalPrismImpact } from "../../../lib/investment/capital-prism-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
function yr(v) {
  return v == null ? "—" : `${v}y`;
}
const BAND_IDS = PRISM_BANDS.map((b) => b.id);
const PRISM_KEYS = ["jobs", "monthly_commitment", "liquidity_gate_years", "horizon_years", "target_pool", "current_savings", "credit_card_outstanding", "real_return_assumption"];

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of PRISM_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}
function prismPlanFrom(reality, branchVars) {
  const m = merged(reality, branchVars);
  return {
    jobs: m.jobs ?? null,
    monthly_commitment: Number(m.monthly_commitment) || 0,
    liquidity_gate_years: Number(m.liquidity_gate_years) || 3,
    horizon_years: Number(m.horizon_years) || 10,
    target_pool: m.target_pool ?? null,
    current_savings: reality.current_savings ?? null,
    credit_card_outstanding: reality.credit_card_outstanding ?? null,
    monthly_income: reality.monthly_income ?? null,
    monthly_expenses: reality.monthly_expenses ?? null,
    real_return_assumption: m.real_return_assumption ?? null,
  };
}
function prismCtxFrom(reality, sceneContext) {
  return {
    availableMonthlyCashflow: sceneContext?.availableMonthlyCashflow ?? reality.available_monthly_cashflow ?? null,
    monthlyIncome: Number(sceneContext?.monthlyIncome ?? reality.monthly_income) || 0,
    monthlyExpenses: Number(sceneContext?.monthlyExpenses ?? reality.monthly_expenses) || 0,
    emergencyBufferMonths: sceneContext?.emergencyBufferMonths ?? null,
  };
}

export function projectCapitalPrismScene({ branchVars, reality, context }) {
  const ctx = prismCtxFrom(reality, context);
  const rf = computeCapitalPrism({ planData: prismPlanFrom(reality, {}), context: ctx });
  const bf = computeCapitalPrism({ planData: prismPlanFrom(reality, branchVars), context: ctx });
  if (!rf.available || !bf.available) return {};
  const impact = projectCapitalPrismImpact({ branchPlan: prismPlanFrom(reality, branchVars), realityPlan: prismPlanFrom(reality, {}), context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "emergency" ? `${sgd(g.possibleAfter)}/mo liquid` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "yearsToTarget", before: rf.yearsToTarget, after: bf.yearsToTarget, unit: "years", dir: bf.yearsToTarget != null && rf.yearsToTarget != null ? (bf.yearsToTarget < rf.yearsToTarget ? "down" : bf.yearsToTarget > rf.yearsToTarget ? "up" : "flat") : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    prism: bf,
    impactSet: impact,
  };
}

function prismTurningPoint({ projection }) {
  const p = projection?.prism;
  if (!p?.available) return null;
  if (p.over) return { id: "prism-over", whyNowKey: "capitalPrism.tp.overAllocated" };
  if (p.investingBlockedByGate) return { id: "prism-gate", whyNowKey: "capitalPrism.tp.readinessGate", whyNowParams: { gate: p.readiness } };
  return null;
}

// ---------- SVG prism ----------
const CP_W = 320;
const CP_H = 250;
const SPEC_X = 116;
const SPEC_W = 184;
const SPEC_TOP = 16;
const SPEC_H = 210;

function PrismField({ t, prism, jobs, gateYears, onSeam, onGate }) {
  const pool = Math.max(1, prism.pool.value || 1);
  const px = (v) => (v / pool) * SPEC_H;
  let cum = 0;
  const rows = BAND_IDS.map((id) => {
    const v = Math.max(0, Number(jobs[id]) || 0);
    const y = SPEC_TOP + px(cum);
    const h = px(v);
    cum += v;
    return { id, v, y, h };
  });
  const assignedH = px(cum);
  const gateFrac = Math.max(0, Math.min(1, (gateYears - 1) / 29));
  const gateY = SPEC_TOP + 4 + gateFrac * (SPEC_H - 8);

  return (
    <svg className="cpField" viewBox={`0 0 ${CP_W} ${CP_H}`} role="group" aria-label={t("capitalPrism.field.label")}>
      {/* beam + prism */}
      <line x1="6" y1={SPEC_TOP + SPEC_H / 2} x2="70" y2={SPEC_TOP + SPEC_H / 2} className="cpBeam" />
      <polygon points={`72,${SPEC_TOP + SPEC_H / 2 - 20} 104,${SPEC_TOP + SPEC_H / 2} 72,${SPEC_TOP + SPEC_H / 2 + 20}`} className="cpPrism" />

      {/* spectrum frame */}
      <rect x={SPEC_X} y={SPEC_TOP} width={SPEC_W} height={SPEC_H} className="cpSpecFrame" />
      {/* unassigned remainder */}
      {assignedH < SPEC_H - 1 ? <rect x={SPEC_X} y={SPEC_TOP + assignedH} width={SPEC_W} height={SPEC_H - assignedH} className="cpUnassigned" /> : null}

      {rows.map((r) => (
        <g key={r.id}>
          <rect x={SPEC_X} y={r.y} width={SPEC_W} height={Math.max(0, r.h)} className={`cpBand cpBand-${r.id}`} />
          {r.h > 12 ? (
            <text x={SPEC_X + 6} y={r.y + 13} className="cpBandLabel">{t(`capitalPrism.job.${r.id}`)} · {sgd(r.v)}</text>
          ) : null}
        </g>
      ))}

      {/* draggable seams between adjacent bands */}
      {rows.slice(0, -1).map((r, i) => {
        const seamY = SPEC_TOP + px(rows.slice(0, i + 1).reduce((s, x) => s + x.v, 0));
        return (
          <g
            key={`seam-${i}`}
            className="cpSeam"
            role="slider"
            tabIndex={0}
            aria-label={t("capitalPrism.field.seam", { a: t(`capitalPrism.job.${rows[i].id}`), b: t(`capitalPrism.job.${rows[i + 1].id}`) })}
            aria-valuemin={0}
            aria-valuemax={Math.round(rows[i].v + rows[i + 1].v)}
            aria-valuenow={Math.round(rows[i].v)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowRight") onSeam(i, -20);
              else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onSeam(i, 20);
              else return;
              e.preventDefault();
            }}
            onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return;
              const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
              const y = ((e.clientY - rect.top) / rect.height) * CP_H - SPEC_TOP;
              const frac = Math.max(0, Math.min(1, y / SPEC_H));
              onSeam(i, { toCumulative: Math.round((frac * pool) / 10) * 10 });
            }}
          >
            <line x1={SPEC_X} y1={seamY} x2={SPEC_X + SPEC_W} y2={seamY} className="cpSeamLine" />
            <circle cx={SPEC_X + SPEC_W - 6} cy={seamY} r="5" className="cpSeamKnot" />
          </g>
        );
      })}

      {/* liquidity gate */}
      <g
        className="cpGate"
        role="slider"
        tabIndex={0}
        aria-label={t("capitalPrism.field.gate", { n: gateYears })}
        aria-valuemin={1}
        aria-valuemax={30}
        aria-valuenow={gateYears}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onGate(Math.min(30, gateYears + 1));
          else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onGate(Math.max(1, gateYears - 1));
          else return;
          e.preventDefault();
        }}
      >
        <line x1={SPEC_X - 8} y1={gateY} x2={SPEC_X + SPEC_W + 8} y2={gateY} className="cpGateLine" />
        <text x={SPEC_X - 10} y={gateY + 3} className="cpGateLabel" textAnchor="end">{gateYears}y</text>
      </g>
    </svg>
  );
}

function CapitalPrismInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [server, setServer] = useState(null);

  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/capital-prism${bid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setServer(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.serverBranch?.id]);

  const prism = useMemo(
    () => (reality ? computeCapitalPrism({ planData: prismPlanFrom(reality, s.branchVars), context: prismCtxFrom(reality, s.context) }) : null),
    [reality, s.branchVars, s.context],
  );
  const proj = s.projection?.prism?.available ? s.projection.prism : prism;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("capitalPrism.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !proj?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("capitalPrism.title")}</h1></header>
        <p className="wlpEmpty">{t("capitalPrism.noPlan")}</p>
      </section>
    );
  }

  const jobs = proj.jobs;
  const gateYears = proj.gateYears;

  const setSeam = (i, arg) => {
    const upperId = BAND_IDS[i];
    const lowerId = BAND_IDS[i + 1];
    const pairTotal = (Number(jobs[upperId]) || 0) + (Number(jobs[lowerId]) || 0);
    const above = BAND_IDS.slice(0, i).reduce((sum, id) => sum + (Number(jobs[id]) || 0), 0);
    let upperVal;
    if (arg && typeof arg === "object" && arg.toCumulative != null) {
      upperVal = Math.max(0, Math.min(pairTotal, arg.toCumulative - above));
    } else {
      upperVal = Math.max(0, Math.min(pairTotal, (Number(jobs[upperId]) || 0) - arg));
    }
    s.setVar("jobs", { ...jobs, [upperId]: Math.round(upperVal), [lowerId]: Math.round(pairTotal - upperVal) });
  };
  const setGate = (v) => s.setVar("liquidity_gate_years", v);

  return (
    <section className="screen wlpScreen lsSceneScreen cpScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("capitalPrism.title")}</h1>
        <p>{t("capitalPrism.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }, { id: "retirement" }]}
        realitySummary={t("capitalPrism.summaryLine", { pool: `${sgd(proj.pool.value)}/mo`, invest: `${sgd(proj.investingCommitment.value)}/mo` })}
        sealMonthlyAmount={proj.investingCommitment.value || 0}
        formatSelf={yr}
        realityRows={[
          { id: "pool", label: t("capitalPrism.row.pool"), value: proj.poolKnown ? `${sgd(proj.pool.value)}/mo` : t("capitalPrism.unknown.available_monthly_cashflow"), provenance: t(`capitalPrism.prov.${proj.pool.provenance}`) },
          { id: "invest", label: t("capitalPrism.row.investing"), value: `${sgd(proj.investingCommitment.value)}/mo`, provenance: t("capitalPrism.prov.noReturn") },
          { id: "liquid", label: t("capitalPrism.row.liquid"), value: `${sgd(proj.liquidKept.value)}/mo`, provenance: t("capitalPrism.prov.transparent") },
          { id: "readiness", label: t("capitalPrism.row.readiness"), value: t(`capitalPrism.readiness.${proj.readiness}`), provenance: t("capitalPrism.prov.gate") },
        ]}
        realityUnknowns={(server?.unknowns ?? proj.unknowns ?? []).map((u) => ({ id: u, label: t(`capitalPrism.unknown.${u}`) }))}
        realityNote={t("capitalPrism.estimateNote")}
      >
        <div className="cpSurface">
          <PrismField t={t} prism={proj} jobs={jobs} gateYears={gateYears} onSeam={setSeam} onGate={setGate} />

          {proj.over ? <p className="wlpWarn">{t("capitalPrism.over", { amount: sgd(proj.assigned - proj.pool.value) })}</p> : <p className="cpReadout">{t("capitalPrism.unassigned", { amount: sgd(Math.max(0, proj.unassigned)) })}</p>}
          <p className="cpReadout">{t("capitalPrism.gateReadout", { years: gateYears, amount: sgd(proj.reachableWithinGate.value) })}</p>
          <p className="cpReadout">{t("capitalPrism.targetReadout", { years: yr(proj.yearsToTarget), target: sgd(proj.targetPool) })}</p>
          {proj.optimistic ? (
            <p className="lsProvenance">{t("capitalPrism.withReturn", { years: proj.optimistic.years, pct: proj.optimistic.assumptionPercent })} — {proj.optimistic.note}</p>
          ) : null}
          {proj.investingBlockedByGate ? <p className="wlpWarn">{t(`capitalPrism.blocked.${proj.readiness}`)}</p> : null}
          {server?.projection?.decisionEcho ? <p className="cpEcho">{t("capitalPrism.decisionEcho")}</p> : null}
          <p className="lsProvenance">{t("capitalPrism.noReturnNote")}</p>

          <div className="rpMirror">
            <button type="button" onClick={() => setGate(Math.min(30, gateYears + 3))}>{t("capitalPrism.mirror.longer")}</button>
            <button type="button" onClick={() => setGate(Math.max(1, gateYears - 3))}>{t("capitalPrism.mirror.sooner")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("capitalPrism.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function CapitalPrism({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="investment" projectFn={projectCapitalPrismScene} turningPointFor={prismTurningPoint}>
      <CapitalPrismInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
