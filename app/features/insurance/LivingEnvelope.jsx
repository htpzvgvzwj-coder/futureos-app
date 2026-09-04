"use client";

// Living Envelope - the Insurance Studio's flagship native scene.
//
// A closed protection membrane around four real life nodes - Income, Home
// loan, Family, Care. Each node sits at a radius = its protection NEED;
// the membrane vertex at that node = the cover the customer holds. Drag a
// vertex outward to stretch cover there - the implied monthly premium
// pressure recomputes live. An Unknown node is drawn dashed and the
// membrane simply skips it; it is NEVER shown as a gap. No policy is
// bought, no underwriting is run, no quote is produced.

import { useEffect, useMemo, useState } from "react";
import { computeLivingEnvelope } from "../../../lib/insurance/living-envelope-finance.js";
import { projectLivingEnvelopeImpact } from "../../../lib/insurance/living-envelope-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";
import { FeatureHistory } from "../../components/future-bank/FeatureHistory.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const ENV_KEYS = ["monthly_premium_now", "income_protection_months", "existing_income_protection", "existing_life_cover", "existing_ci_cover", "home_loan_outstanding", "dependents", "desired_cover", "minimum_current_breathing_room", "minimum_income_protection_months"];

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of ENV_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}
function envPlanFrom(reality, branchVars) {
  return merged(reality, branchVars);
}
function envCtxFrom(reality, sceneContext) {
  return {
    monthlyIncome: Number(sceneContext?.monthlyIncome ?? reality.monthly_income) || 0,
    monthlyExpenses: Number(sceneContext?.monthlyExpenses ?? reality.monthly_expenses) || 0,
    otherGoalsMonthlyOutflow: Number(sceneContext?.committedMonthlyTotal ?? sceneContext?.committedExcludingDomain) || 0,
  };
}

export function projectLivingEnvelopeScene({ branchVars, reality, context }) {
  const ctx = envCtxFrom(reality, context);
  const rf = computeLivingEnvelope({ planData: envPlanFrom(reality, {}), context: ctx });
  const bf = computeLivingEnvelope({ planData: envPlanFrom(reality, branchVars), context: ctx });
  if (!rf.available || !bf.available) return {};
  const impact = projectLivingEnvelopeImpact({ branchPlan: envPlanFrom(reality, branchVars), realityPlan: envPlanFrom(reality, {}), context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "emergency" ? `${sgd(g.possibleAfter)}/mo room` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "knownExposure", before: rf.knownExposure, after: bf.knownExposure, unit: "sgd", dir: bf.knownExposure < rf.knownExposure ? "down" : bf.knownExposure > rf.knownExposure ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    envelope: bf,
    impactSet: impact,
  };
}

function envelopeTurningPoint({ projection }) {
  const l = projection?.envelope;
  if (!l?.available) return null;
  if (l.liquidityConflict) return { id: "envelope-liquidity", whyNowKey: "livingEnvelope.tp.liquidityConflict", ifYouWaitKey: "livingEnvelope.tp.liquidityConflictWait" };
  if (l.belowBreathing) return { id: "envelope-below-breathing", whyNowKey: "livingEnvelope.tp.belowBreathing" };
  if (l.belowIncomeFloor) return { id: "envelope-income-floor", whyNowKey: "livingEnvelope.tp.belowIncomeFloor" };
  return null;
}

// ---------- SVG membrane ----------
const LE_W = 320;
const LE_H = 260;
const CX = 160;
const CY = 130;
const NEED_R = 92;

function pt(r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function MembraneField({ t, envelope, onCover }) {
  const membrane = envelope.membrane;
  const verts = membrane.map((m) => {
    const frac = m.coverRatio == null ? 0.55 : Math.max(0.08, Math.min(1.2, m.coverRatio));
    return { ...m, ...pt(NEED_R * frac, m.angle), frac };
  });
  const poly = verts.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(" ");

  return (
    <svg className="leField" viewBox={`0 0 ${LE_W} ${LE_H}`} role="group" aria-label={t("livingEnvelope.field.label")}>
      {/* need ring */}
      <circle cx={CX} cy={CY} r={NEED_R} className="leNeedRing" />
      {/* membrane */}
      <polygon points={poly} className="leMembrane" />

      {membrane.map((m) => {
        const outer = pt(NEED_R, m.angle);
        const v = verts.find((x) => x.id === m.id);
        return (
          <g key={m.id}>
            {/* exposure wedge when the membrane is inside the node */}
            {m.state === "gap" ? <line x1={v.x} y1={v.y} x2={outer.x} y2={outer.y} className="leExposure" /> : null}
            <circle cx={outer.x} cy={outer.y} r="6" className={`leNode le-${m.state}`} />
            <text x={pt(NEED_R + 16, m.angle).x} y={pt(NEED_R + 16, m.angle).y + 3} className="leNodeLabel" textAnchor="middle">
              {t(`livingEnvelope.node.${m.id}`)}
            </text>
            <text x={pt(NEED_R + 16, m.angle).x} y={pt(NEED_R + 16, m.angle).y + 13} className="leNodeSub" textAnchor="middle">
              {m.state === "unknown" ? t("livingEnvelope.unknownShort") : `${sgd(m.have)} / ${sgd(m.need)}`}
            </text>

            {m.state !== "unknown" ? (
              <g
                className="leHandle"
                role="slider"
                tabIndex={0}
                aria-label={t("livingEnvelope.field.handle", { node: t(`livingEnvelope.node.${m.id}`) })}
                aria-valuemin={0}
                aria-valuemax={Math.round(m.need)}
                aria-valuenow={Math.round(m.have)}
                onKeyDown={(e) => {
                  const step = Math.max(1000, Math.round(m.need * 0.05));
                  if (e.key === "ArrowUp" || e.key === "ArrowRight") onCover(m.id, m.have + step, m.need);
                  else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onCover(m.id, Math.max(0, m.have - step), m.need);
                  else return;
                  e.preventDefault();
                }}
                onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
                onPointerMove={(e) => {
                  if (e.buttons !== 1) return;
                  const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  const x = ((e.clientX - r.left) / r.width) * LE_W - CX;
                  const y = ((e.clientY - r.top) / r.height) * LE_H - CY;
                  const frac = Math.max(0, Math.min(1.2, Math.hypot(x, y) / NEED_R));
                  onCover(m.id, Math.round((frac * m.need) / 1000) * 1000, m.need);
                }}
              >
                <circle cx={v.x} cy={v.y} r="7" className="leHandleKnot" />
              </g>
            ) : null}
          </g>
        );
      })}

      <text x={CX} y={CY - 4} className="leCentreValue" textAnchor="middle">{sgd(envelope.knownExposure)}</text>
      <text x={CX} y={CY + 12} className="leCentreSub" textAnchor="middle">{t("livingEnvelope.exposureLabel")}</text>
    </svg>
  );
}

function LivingEnvelopeInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [server, setServer] = useState(null);

  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/living-envelope${bid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setServer(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.serverBranch?.id]);

  const envelope = useMemo(
    () => (reality ? computeLivingEnvelope({ planData: envPlanFrom(reality, s.branchVars), context: envCtxFrom(reality, s.context) }) : null),
    [reality, s.branchVars, s.context],
  );
  const proj = s.projection?.envelope?.available ? s.projection.envelope : envelope;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("livingEnvelope.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !proj?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("livingEnvelope.title")}</h1></header>
        <p className="wlpEmpty">{t("livingEnvelope.noPlan")}</p>
        <FeatureHistory feature="protect_handoff" label="Protection & handoff you've set" />
      </section>
    );
  }

  const cur = s.branchVars.desired_cover ?? {};
  const setCover = (nodeId, targetHave) => {
    s.setVar("desired_cover", { ...cur, [nodeId]: Math.max(0, Math.round(targetHave)) });
  };

  return (
    <section className="screen wlpScreen lsSceneScreen leScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("livingEnvelope.title")}</h1>
        <p>{t("livingEnvelope.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }, { id: "family" }]}
        realitySummary={t("livingEnvelope.summaryLine", { exposure: sgd(proj.knownExposure), premium: `${sgd(proj.premiumAfter.value)}/mo` })}
        sealMonthlyAmount={proj.premiumAfter.value || 0}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "exposure", label: t("livingEnvelope.row.exposure"), value: sgd(proj.knownExposure), provenance: t("livingEnvelope.prov.knownOnly") },
          { id: "premium", label: t("livingEnvelope.row.premium"), value: `${sgd(proj.premiumNow.value)}/mo`, provenance: t(`livingEnvelope.prov.${proj.premiumNow.provenance}`) },
          { id: "toClose", label: t("livingEnvelope.row.toClose"), value: `${sgd(proj.premiumToCloseKnownGaps)}/mo`, provenance: t("livingEnvelope.prov.referenceRate") },
          { id: "status", label: t("livingEnvelope.row.status"), value: t(`livingEnvelope.status.${proj.envelopeStatus}`), provenance: t("livingEnvelope.prov.transparent") },
        ]}
        realityUnknowns={(server?.unknowns ?? proj.unknowns ?? []).map((u) => ({ id: u, label: t(`livingEnvelope.unknown.${u}`) }))}
        realityNote={t("livingEnvelope.estimateNote")}
      >
        <div className="leSurface">
          <MembraneField t={t} envelope={proj} onCover={(id, v) => setCover(id, v)} />

          <p className="leReadout">{t("livingEnvelope.premiumReadout", { now: sgd(proj.premiumNow.value), after: sgd(proj.premiumAfter.value) })}</p>
          {proj.unknownCount > 0 ? <p className="leUnknownNote">{t("livingEnvelope.unknownNote", { n: proj.unknownCount })}</p> : null}
          {proj.belowIncomeFloor ? <p className="wlpWarn">{t("livingEnvelope.belowIncomeFloor")}</p> : null}
          {server?.projection?.decisionEcho ? <p className="leEcho">{t("livingEnvelope.decisionEcho")}</p> : null}
          <p className="lsProvenance">{t("livingEnvelope.noPolicyNote")}</p>

          <div className="rpMirror">
            <button type="button" onClick={() => { const first = proj.membrane.find((m) => m.state === "gap"); if (first) setCover(first.id, first.need); }}>{t("livingEnvelope.mirror.close")}</button>
            <button type="button" onClick={() => s.setVar("desired_cover", {})}>{t("livingEnvelope.mirror.clear")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("livingEnvelope.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>

      <FeatureHistory feature="protect_handoff" label="Protection & handoff you've set" />
    </section>
  );
}

export function LivingEnvelope({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="insurance" projectFn={projectLivingEnvelopeScene} turningPointFor={envelopeTurningPoint}>
      <LivingEnvelopeInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
