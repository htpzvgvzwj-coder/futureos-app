"use client";

// Private Constellation - the Family Studio's flagship native scene.
//
// TWO INDEPENDENT identities share one future. This scene is always drawn
// from ONE viewer's side: it shows the viewer's own star, their own marks
// and range in full, and of the PARTNER only a redacted silhouette -
// never their numbers, never their per-item marks. A shared goal node
// "locks" (a solid link is drawn) only when BOTH marked it Must Keep and
// BOTH confirmed - separately. Nothing seals until both have joined and
// confirmed.

import { useEffect, useMemo, useState } from "react";
import { computePrivateConstellation } from "../../../lib/family/private-constellation-finance.js";
import { projectPrivateConstellationImpact } from "../../../lib/family/private-constellation-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const FAM_KEYS = ["shared_monthly_contribution", "partner_share_ratio"];

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of FAM_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}
function planFrom(reality, branchVars, participants) {
  const m = merged(reality, branchVars);
  return {
    shared_monthly_contribution: Number(m.shared_monthly_contribution) || 0,
    partner_share_ratio: Number(m.partner_share_ratio ?? 0.5),
    items: Array.isArray(reality.items) ? reality.items : [],
    participants: participants ?? [],
    monthly_income: reality.monthly_income ?? null,
    monthly_expenses: reality.monthly_expenses ?? null,
    minimum_current_breathing_room: Number(branchVars.minimum_current_breathing_room) || 0,
  };
}
function ctxFrom(reality, sceneContext) {
  return {
    monthlyIncome: Number(sceneContext?.monthlyIncome ?? reality.monthly_income) || 0,
    monthlyExpenses: Number(sceneContext?.monthlyExpenses ?? reality.monthly_expenses) || 0,
    otherGoalsMonthlyOutflow: Number(sceneContext?.committedMonthlyTotal ?? sceneContext?.committedExcludingDomain) || 0,
  };
}

export function projectPrivateConstellationScene({ branchVars, reality, context }) {
  const ctx = ctxFrom(reality, context);
  const rf = computePrivateConstellation({ planData: planFrom(reality, {}, []), context: ctx });
  const bf = computePrivateConstellation({ planData: planFrom(reality, branchVars, []), context: ctx });
  if (!rf.available || !bf.available) return {};
  const impact = projectPrivateConstellationImpact({ branchPlan: planFrom(reality, branchVars, []), realityPlan: planFrom(reality, {}, []), context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "emergency" ? `${sgd(g.possibleAfter)}/mo room` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "yourShare", before: rf.viewerShare.value, after: bf.viewerShare.value, unit: "sgd", dir: bf.viewerShare.value < rf.viewerShare.value ? "down" : bf.viewerShare.value > rf.viewerShare.value ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    constellation: bf,
    impactSet: impact,
  };
}

function constellationTurningPoint({ projection }) {
  const c = projection?.constellation;
  if (!c?.available) return null;
  if (c.liquidityConflict) return { id: "constellation-liquidity", whyNowKey: "privateConstellation.tp.liquidityConflict" };
  return null;
}

// ---------- SVG two-body constellation ----------
const PC_W = 320;
const PC_H = 220;
const YOU = { x: 54, y: 110 };
const PARTNER = { x: 266, y: 110 };
const CENTRE = { x: 160, y: 110 };
const MARK_ORDER = ["flexible", "undecided", "mustKeep"];

function ConstellationField({ t, constellation, items, viewerMarks, onMark }) {
  const other = constellation.otherParticipant;
  const locked = new Set(constellation.lockedNodes ?? []);
  return (
    <svg className="pcField" viewBox={`0 0 ${PC_W} ${PC_H}`} role="group" aria-label={t("privateConstellation.field.label")}>
      {/* the link between the two stars, drawn faint unless a node locked */}
      <line x1={YOU.x} y1={YOU.y} x2={PARTNER.x} y2={PARTNER.y} className={`pcLink ${locked.size > 0 ? "is-locked" : ""}`} />

      {/* your star */}
      <circle cx={YOU.x} cy={YOU.y} r="12" className="pcYou" />
      <text x={YOU.x} y={YOU.y + 28} className="pcStarLabel" textAnchor="middle">{t("privateConstellation.you")}</text>

      {/* partner star - redacted silhouette */}
      <circle cx={PARTNER.x} cy={PARTNER.y} r="12" className={`pcPartner ${other?.confirmed ? "is-confirmed" : ""} ${other ? "" : "is-absent"}`} />
      <text x={PARTNER.x} y={PARTNER.y + 28} className="pcStarLabel" textAnchor="middle">
        {other ? (other.confirmed ? t("privateConstellation.partnerConfirmed") : t("privateConstellation.partnerJoined")) : t("privateConstellation.partnerAbsent")}
      </text>

      {/* shared goal nodes - drag toward you = Must Keep, away = Flexible */}
      {items.map((it, i) => {
        const mark = viewerMarks[it.id] ?? "undecided";
        const frac = mark === "mustKeep" ? 0.34 : mark === "flexible" ? 0.78 : 0.56;
        const y = 40 + (i * (PC_H - 70)) / Math.max(1, items.length - 1 || 1);
        const x = YOU.x + frac * (PARTNER.x - YOU.x);
        return (
          <g
            key={it.id}
            className="pcNode"
            role="slider"
            tabIndex={0}
            aria-label={t("privateConstellation.field.node", { item: it.label ?? it.id })}
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={MARK_ORDER.indexOf(mark)}
            onKeyDown={(e) => {
              const idx = MARK_ORDER.indexOf(mark);
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") onMark(it.id, MARK_ORDER[Math.max(0, idx + 1 > 2 ? 2 : idx + 1)]);
              else if (e.key === "ArrowRight" || e.key === "ArrowDown") onMark(it.id, MARK_ORDER[Math.max(0, idx - 1)]);
              else return;
              e.preventDefault();
            }}
            onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return;
              const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * PC_W;
              const f = (px - YOU.x) / (PARTNER.x - YOU.x);
              onMark(it.id, f < 0.45 ? "mustKeep" : f > 0.68 ? "flexible" : "undecided");
            }}
          >
            <line x1={CENTRE.x} y1={y} x2={x} y2={y} className="pcNodeStem" />
            <circle cx={x} cy={y} r="7" className={`pcNodeDot pc-${mark} ${locked.has(it.id) ? "is-locked" : ""}`} />
            <text x={x} y={y - 11} className="pcNodeLabel" textAnchor="middle">{it.label ?? it.id}</text>
          </g>
        );
      })}

      <text x={CENTRE.x} y={CENTRE.y - 40} className="pcConflicts" textAnchor="middle">
        {constellation.conflictCount > 0 ? t("privateConstellation.conflicts", { n: constellation.conflictCount }) : ""}
      </text>
    </svg>
  );
}

function PrivateConstellationInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [server, setServer] = useState(null);
  const [busy, setBusy] = useState(false);

  const refetch = () => {
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/private-constellation${bid}`).then((r) => (r.ok ? r.json() : null)).then((d) => setServer(d)).catch(() => {});
  };
  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/private-constellation${bid}`).then((r) => (r.ok ? r.json() : null)).then((d) => alive && setServer(d)).catch(() => {});
    return () => { alive = false; };
  }, [s.serverBranch?.id]);

  const local = useMemo(
    () => (reality ? computePrivateConstellation({ planData: planFrom(reality, s.branchVars, []), context: ctxFrom(reality, s.context) }) : null),
    [reality, s.branchVars, s.context],
  );
  const proj = s.projection?.constellation?.available ? s.projection.constellation : local;
  const serverC = server?.reality?.constellation ?? null;
  const items = Array.isArray(reality?.items) ? reality.items : [];

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("privateConstellation.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !proj?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("privateConstellation.title")}</h1></header>
        <p className="wlpEmpty">{t("privateConstellation.noPlan")}</p>
      </section>
    );
  }

  const shared = Number(s.branchVars.shared_monthly_contribution ?? reality.shared_monthly_contribution) || 0;
  const viewerMarks = (serverC?.viewerView?.marks) ?? {};

  const setMark = async (itemId, mark) => {
    if (busy) return;
    setBusy(true);
    const nextMarks = { ...viewerMarks, [itemId]: mark };
    try {
      await fetch("/api/private-constellation?action=set_view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ affordableMin: serverC?.viewerView?.affordableMin ?? 0, affordableMax: serverC?.viewerView?.affordableMax ?? 0, marks: nextMarks }),
      });
      refetch();
    } finally {
      setBusy(false);
    }
  };
  const confirmMine = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/private-constellation?action=confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ affordableMin: serverC?.viewerView?.affordableMin ?? 0, affordableMax: serverC?.viewerView?.affordableMax ?? 0, marks: viewerMarks }),
      });
      refetch();
    } finally {
      setBusy(false);
    }
  };

  const displayC = serverC ?? proj;

  return (
    <section className="screen wlpScreen lsSceneScreen pcScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("privateConstellation.title")}</h1>
        <p>{t("privateConstellation.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }, { id: "retirement" }]}
        realitySummary={t("privateConstellation.summaryLine", { yours: `${sgd(proj.viewerShare.value)}/mo`, shared: `${sgd(shared)}/mo` })}
        sealMonthlyAmount={proj.viewerShare.value || 0}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "yours", label: t("privateConstellation.row.yours"), value: `${sgd(proj.viewerShare.value)}/mo`, provenance: t("privateConstellation.prov.yours") },
          { id: "shared", label: t("privateConstellation.row.shared"), value: `${sgd(shared)}/mo`, provenance: t("privateConstellation.prov.agreed") },
          { id: "band", label: t("privateConstellation.row.band"), value: displayC.jointBand ? `${sgd(displayC.jointBand.low)}–${sgd(displayC.jointBand.high)}` : t("privateConstellation.noBand"), provenance: t("privateConstellation.prov.merged") },
          { id: "partner", label: t("privateConstellation.row.partner"), value: displayC.otherParticipant ? (displayC.otherParticipant.confirmed ? t("privateConstellation.partnerConfirmed") : t("privateConstellation.partnerJoined")) : t("privateConstellation.partnerAbsent"), provenance: t("privateConstellation.prov.redacted") },
        ]}
        realityUnknowns={(server?.unknowns ?? proj.unknowns ?? []).map((u) => ({ id: u, label: t(`privateConstellation.unknown.${u}`) }))}
        realityNote={t("privateConstellation.estimateNote")}
      >
        <div className="pcSurface">
          <ConstellationField t={t} constellation={displayC} items={items} viewerMarks={viewerMarks} onMark={setMark} />

          <label className="pcCtlRow">
            <span>{t("privateConstellation.sharedContribution")}</span>
            <div className="toStepper">
              <button type="button" onClick={() => s.setVar("shared_monthly_contribution", Math.max(0, shared - 100))} aria-label={t("privateConstellation.less")}>−</button>
              <b>{sgd(shared)}</b>
              <button type="button" onClick={() => s.setVar("shared_monthly_contribution", shared + 100)} aria-label={t("privateConstellation.more")}>+</button>
            </div>
          </label>

          <p className="pcReadout">{t("privateConstellation.shareReadout", { yours: sgd(proj.viewerShare.value), theirs: sgd(proj.otherShare.value) })}</p>
          {displayC.bothConfirmedRequired ? <p className="pcWarn">{t("privateConstellation.needsBoth")}</p> : null}
          {server?.inviteCode ? <p className="pcInvite">{t("privateConstellation.inviteCode", { code: server.inviteCode })}</p> : null}
          {server?.projection?.decisionEcho ? <p className="pcEcho">{t("privateConstellation.decisionEcho")}</p> : null}
          <p className="lsProvenance">{t("privateConstellation.privacyNote")}</p>

          <div className="rpMirror">
            <button type="button" disabled={busy || !serverC} onClick={confirmMine}>
              {serverC?.viewerView?.confirmed ? t("privateConstellation.confirmed") : t("privateConstellation.confirmMine")}
            </button>
            <button type="button" onClick={() => s.resetBranch()}>{t("privateConstellation.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function PrivateConstellation({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="family" projectFn={projectPrivateConstellationScene} turningPointFor={constellationTurningPoint}>
      <PrivateConstellationInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
