"use client";

// Wedding Living Scene - one continuous scene, no five permanent tabs.
//
// The main body is the Budget River: the wedding's monthly cost flowing
// along a time axis from now to the wedding month. Drag the guest knob to
// widen / narrow the river (the Guest Orbit ring appears in place while
// you drag); drag the date knob along the axis to move the wedding. Venue
// and Couple Alignment open as contextual sheets on the current decision.
// History stays hidden until the Memory Scrubber is pulled. After Seal the
// scene stays put and the Guardian rail accompanies it.

import { useMemo, useState } from "react";
import { computeWeddingPlanFinance } from "../../../lib/wedding/plan-finance.js";
import { projectWeddingThreadImpact } from "../../../lib/wedding/wedding-thread-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const WED_KEYS = ["wedding_date", "guest_count", "venue_tier", "venue_type", "photography_tier", "attire_tier", "total_budget", "monthly_contribution", "partner_contribution"];
const VENUE_TIERS = ["budget", "mid_range", "premium"];
const MIN_GUESTS = 10;
const MAX_GUESTS = 400;

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of WED_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}
function wedCtxFrom(reality, sceneContext) {
  return {
    monthlyIncome: Number(sceneContext?.monthlyIncome ?? reality.monthly_income) || 0,
    monthlyExpenses: Number(sceneContext?.monthlyExpenses ?? reality.monthly_expenses) || 0,
    committedExcludingWedding: Number(sceneContext?.committedMonthlyTotal ?? sceneContext?.committedExcludingDomain) || 0,
  };
}

export function projectWeddingScene({ branchVars, reality, context }) {
  const ctx = wedCtxFrom(reality, context);
  const rf = computeWeddingPlanFinance({ planData: reality });
  const bf = computeWeddingPlanFinance({ planData: merged(reality, branchVars) });
  if (!rf.available || !bf.available) return {};
  const impact = projectWeddingThreadImpact({ branchPlan: merged(reality, branchVars), realityPlan: reality, context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "emergency" ? `${sgd(g.possibleAfter)}/mo room` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "planTotal", before: rf.planTotal, after: bf.planTotal, unit: "sgd", dir: bf.planTotal < rf.planTotal ? "down" : bf.planTotal > rf.planTotal ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    wedding: bf,
    impactSet: impact,
  };
}

function weddingTurningPoint({ projection }) {
  const w = projection?.wedding;
  if (!w?.available) return null;
  if (w.budgetGap > 0) return { id: "wed-budget-gap", whyNowKey: "weddingScene.tp.budgetGap", whyNowParams: { amount: w.budgetGap } };
  if (w.onPace === false) return { id: "wed-behind-pace", whyNowKey: "weddingScene.tp.behindPace", whyNowParams: { need: w.userRequiredMonthly } };
  return null;
}

// ---------- SVG budget river ----------
const RV_W = 320;
const RV_H = 150;
const AXIS_Y = 118;
const RV_LEFT = 20;
const RV_RIGHT = 300;

function monthKeyToIdx(m) {
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return null;
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  return y * 12 + (mo - 1);
}
function shiftMonth(m, by) {
  const s = /^\d{4}-\d{2}/.test(String(m ?? "")) ? String(m).slice(0, 7) : new Date().toISOString().slice(0, 7);
  const [y, mo] = s.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + by;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function RiverField({ t, wed, m, dragGuests, onGuests, onDate }) {
  const nowIdx = new Date().getUTCFullYear() * 12 + new Date().getUTCMonth();
  const tripIdx = monthKeyToIdx(m.wedding_date);
  const span = tripIdx != null ? Math.max(1, tripIdx - nowIdx) : 12;
  const dateX = RV_LEFT + Math.min(1, span / 36) * (RV_RIGHT - RV_LEFT);
  const req = wed.userRequiredMonthly ?? wed.userMonthly ?? 0;
  const thick = Math.max(4, Math.min(52, (req / 40)));
  const guests = Number(m.guest_count) || MIN_GUESTS;
  const guestFrac = Math.max(0, Math.min(1, (guests - MIN_GUESTS) / (MAX_GUESTS - MIN_GUESTS)));

  return (
    <svg className="wcField" viewBox={`0 0 ${RV_W} ${RV_H}`} role="group" aria-label={t("weddingScene.field.label")}>
      {/* time axis */}
      <line x1={RV_LEFT} y1={AXIS_Y} x2={RV_RIGHT} y2={AXIS_Y} className="wcAxis" />
      <text x={RV_LEFT} y={AXIS_Y + 14} className="wcSmall">{t("weddingScene.now")}</text>
      <text x={dateX} y={AXIS_Y + 14} className="wcSmall" textAnchor="middle">{m.wedding_date || "?"}</text>

      {/* the river: a band from now to the wedding, thickness = monthly need */}
      <path
        d={`M ${RV_LEFT} ${AXIS_Y - 6} L ${dateX} ${AXIS_Y - 6 - thick} L ${dateX} ${AXIS_Y - 6} Z`}
        className={`wcRiver ${wed.budgetGap > 0 ? "is-short" : ""}`}
      />

      {/* payment markers */}
      {(wed.paymentSchedule ?? []).map((p, i) => {
        const px = RV_LEFT + ((i + 1) / ((wed.paymentSchedule?.length ?? 1) + 1)) * (dateX - RV_LEFT);
        return <circle key={p.id ?? i} cx={px} cy={AXIS_Y} r="3" className="wcPay" />;
      })}

      {/* guest knob - vertical drag widens / narrows the river */}
      <g
        className="wcGuests"
        role="slider"
        tabIndex={0}
        aria-label={t("weddingScene.field.guests", { n: guests })}
        aria-valuemin={MIN_GUESTS}
        aria-valuemax={MAX_GUESTS}
        aria-valuenow={guests}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onGuests(Math.min(MAX_GUESTS, guests + 10));
          else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onGuests(Math.max(MIN_GUESTS, guests - 10));
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          onGuests(guests, true);
        }}
        onPointerUp={() => onGuests(guests, false)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          const y = ((e.clientY - r.top) / r.height) * RV_H;
          const frac = Math.max(0, Math.min(1, (AXIS_Y - y) / 90));
          onGuests(Math.round((MIN_GUESTS + frac * (MAX_GUESTS - MIN_GUESTS)) / 10) * 10, true);
        }}
      >
        <line x1={RV_LEFT} y1={AXIS_Y - 6 - thick} x2={RV_LEFT} y2={AXIS_Y - 6} className="wcGuestStem" />
        <circle cx={RV_LEFT} cy={AXIS_Y - 6 - thick} r="7" className="wcGuestKnot" />
        <text x={RV_LEFT + 12} y={AXIS_Y - 6 - thick + 3} className="wcSmall">{guests} {t("weddingScene.guestsWord")}</text>
      </g>

      {/* date knob on the axis */}
      <g
        className="wcDate"
        role="slider"
        tabIndex={0}
        aria-label={t("weddingScene.field.date")}
        aria-valuemin={1}
        aria-valuemax={36}
        aria-valuenow={span}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onDate(1);
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onDate(-1);
          else return;
          e.preventDefault();
        }}
      >
        <circle cx={dateX} cy={AXIS_Y} r="7" className="wcDateKnot" />
      </g>

      {/* Guest Orbit ring - appears in place only while dragging headcount */}
      {dragGuests ? (
        <g className="wcOrbit">
          <circle cx={RV_W - 44} cy={40} r={12 + guestFrac * 22} className="wcOrbitRing" />
          <text x={RV_W - 44} y={44} className="wcSmall" textAnchor="middle">{guests}</text>
        </g>
      ) : null}
    </svg>
  );
}

function WeddingSceneInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [sheet, setSheet] = useState(null); // "venue" | "couple" | null
  const [dragGuests, setDragGuests] = useState(false);

  const m = useMemo(() => (reality ? merged(reality, s.branchVars) : null), [reality, s.branchVars]);
  const wed = useMemo(
    () => (reality ? computeWeddingPlanFinance({ planData: merged(reality, s.branchVars) }) : null),
    [reality, s.branchVars],
  );
  const proj = s.projection?.wedding?.available ? s.projection.wedding : wed;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("weddingScene.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !proj?.available || !m) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("weddingScene.title")}</h1></header>
        <p className="wlpEmpty">{t("weddingScene.noPlan")}</p>
      </section>
    );
  }

  const guests = Number(m.guest_count) || MIN_GUESTS;
  const partnerMonthly = Number(m.partner_contribution) || 0;
  const set = (k, v) => s.setVar(k, v);
  const onGuests = (n, dragging) => {
    if (dragging != null) setDragGuests(dragging);
    if (Number.isFinite(n)) set("guest_count", Math.max(MIN_GUESTS, Math.min(MAX_GUESTS, n)));
  };

  return (
    <section className="screen wlpScreen lsSceneScreen wcScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("weddingScene.title")}</h1>
        <p>{t("weddingScene.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }, { id: "retirement" }]}
        realitySummary={t("weddingScene.summaryLine", { cost: sgd(proj.planTotal), month: reality.wedding_date || t("weddingScene.unknown.wedding_date") })}
        sealMonthlyAmount={proj.userRequiredMonthly || proj.userMonthly || 0}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "cost", label: t("weddingScene.row.cost"), value: sgd(proj.computedCoreTotal), provenance: t("weddingScene.prov.referenceRate") },
          { id: "guests", label: t("weddingScene.row.guests"), value: `${reality.guest_count ?? t("weddingScene.unknown.guest_count")}`, provenance: t("weddingScene.prov.fromPlan") },
          { id: "need", label: t("weddingScene.row.need"), value: `${sgd(proj.userRequiredMonthly ?? 0)}/mo`, provenance: t("weddingScene.prov.yourShare") },
          { id: "gap", label: t("weddingScene.row.gap"), value: proj.budgetGap > 0 ? sgd(proj.budgetGap) : t("weddingScene.none"), provenance: t("weddingScene.prov.vsBudget") },
        ]}
        realityUnknowns={[
          reality.guest_count == null ? { id: "guest_count", label: t("weddingScene.unknown.guest_count") } : null,
          reality.wedding_date == null ? { id: "wedding_date", label: t("weddingScene.unknown.wedding_date") } : null,
        ].filter(Boolean)}
        realityNote={t("weddingScene.estimateNote")}
      >
        <div className="wcSurface">
          <RiverField t={t} wed={proj} m={m} dragGuests={dragGuests} onGuests={onGuests} onDate={(by) => set("wedding_date", shiftMonth(m.wedding_date, by))} />

          {proj.budgetGap > 0 ? <p className="wlpWarn">{t("weddingScene.belowCost", { amount: sgd(proj.budgetGap) })}</p> : null}
          <p className="wcReadout">{t("weddingScene.readout", { perGuest: sgd(guests ? Math.round(proj.planTotal / guests) : 0), need: sgd(proj.userRequiredMonthly ?? 0) })}</p>

          {/* contextual sheets on the current decision - not permanent tabs */}
          <div className="wcCtx">
            <button type="button" className="lsGhostBtn" aria-expanded={sheet === "venue"} onClick={() => setSheet(sheet === "venue" ? null : "venue")}>{t("weddingScene.ctx.venue")}</button>
            <button type="button" className="lsGhostBtn" aria-expanded={sheet === "couple"} onClick={() => setSheet(sheet === "couple" ? null : "couple")}>{t("weddingScene.ctx.couple")}</button>
          </div>
          {sheet === "venue" ? (
            <div className="wcSheet">
              <span>{t("weddingScene.venueTier")}</span>
              <div className="toSeg">
                {VENUE_TIERS.map((v) => (
                  <button key={v} type="button" className={m.venue_tier === v ? "is-on" : ""} onClick={() => set("venue_tier", v)}>{t(`weddingScene.venue.${v}`)}</button>
                ))}
              </div>
            </div>
          ) : null}
          {sheet === "couple" ? (
            <div className="wcSheet">
              <label>
                <span>{t("weddingScene.partnerMonthly")}</span>
                <div className="toStepper">
                  <button type="button" onClick={() => set("partner_contribution", Math.max(0, partnerMonthly - 50))} aria-label={t("weddingScene.less")}>−</button>
                  <b>{sgd(partnerMonthly)}</b>
                  <button type="button" onClick={() => set("partner_contribution", partnerMonthly + 50)} aria-label={t("weddingScene.more")}>+</button>
                </div>
              </label>
              <p className="lsProvenance">{t("weddingScene.partnerNote")}</p>
            </div>
          ) : null}

          <div className="rpMirror">
            <button type="button" onClick={() => onGuests(guests - 20)}>{t("weddingScene.mirror.fewer")}</button>
            <button type="button" onClick={() => set("wedding_date", shiftMonth(m.wedding_date, 3))}>{t("weddingScene.mirror.later")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("weddingScene.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function WeddingContinuousScene({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="wedding" projectFn={projectWeddingScene} turningPointFor={weddingTurningPoint}>
      <WeddingSceneInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
