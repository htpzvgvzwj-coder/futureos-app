"use client";

// Calendar Orbit - the Travel Studio's flagship native scene.
//
// The trip is a knob on a 12-month orbit ring. Drag it around the ring to
// move the trip month; drag the radial handle in/out to change the number
// of nights. A funding arc sweeps from "now" to the balance-due month and
// fills with the money already on pace. Every change re-runs the real
// reference-rate engine (never a fare quote), a transparent seasonality
// band, and a SERVER-owned cross-goal impactSet. Guardian here only ever
// watches payment windows - it never books anything.

import { useEffect, useMemo, useState } from "react";
import { computeCalendarOrbit } from "../../../lib/travel/calendar-orbit-finance.js";
import { projectCalendarOrbitImpact } from "../../../lib/travel/calendar-orbit-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
function range(r) {
  return r ? `${sgd(r.low)}–${sgd(r.high)}` : "—";
}
const COMFORT = ["budget", "mid", "premium"];
const DEST = ["domestic", "regional", "longhaul"];
const TRAVEL_KEYS = ["travellers", "nights", "comfort_tier", "destination_type", "trip_month", "total_budget", "monthly_contribution"];
const MIN_NIGHTS = 2;
const MAX_NIGHTS = 21;

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of TRAVEL_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}
function orbitPlanFrom(reality, branchVars) {
  const m = merged(reality, branchVars);
  return {
    travellers: Number(m.travellers) || 0,
    nights: Number(m.nights) || 0,
    comfort_tier: m.comfort_tier ?? "mid",
    destination_type: m.destination_type ?? "regional",
    trip_month: m.trip_month ?? null,
    total_budget: m.total_budget ?? null,
    monthly_contribution: Number(m.monthly_contribution) || 0,
    current_savings: reality.current_savings ?? null,
    latest_trip_month: Number(branchVars.latest_trip_month) || Number(reality.latest_trip_month) || 0,
    minimum_current_breathing_room: Number(branchVars.minimum_current_breathing_room) || 0,
  };
}
function orbitCtxFrom(reality, sceneContext) {
  return {
    monthlyIncome: Number(sceneContext?.monthlyIncome ?? reality.monthly_income) || 0,
    monthlyExpenses: Number(sceneContext?.monthlyExpenses ?? reality.monthly_expenses) || 0,
    otherGoalsMonthlyOutflow: Number(sceneContext?.committedMonthlyTotal ?? sceneContext?.committedExcludingDomain) || 0,
    currentSavings: reality.current_savings ?? sceneContext?.currentSavings ?? null,
    emergencyBufferMonths: sceneContext?.emergencyBufferMonths ?? null,
  };
}

export function projectCalendarOrbitScene({ branchVars, reality, context }) {
  const ctx = orbitCtxFrom(reality, context);
  const rf = computeCalendarOrbit({ planData: orbitPlanFrom(reality, {}), context: ctx });
  const bf = computeCalendarOrbit({ planData: orbitPlanFrom(reality, branchVars), context: ctx });
  if (!rf.available || !bf.available) return {};
  const impact = projectCalendarOrbitImpact({ branchPlan: orbitPlanFrom(reality, branchVars), realityPlan: orbitPlanFrom(reality, {}), context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "emergency" ? `${sgd(g.possibleAfter)}/mo room` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "planTotal", before: rf.planTotal, after: bf.planTotal, unit: "sgd", dir: bf.planTotal < rf.planTotal ? "down" : bf.planTotal > rf.planTotal ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    orbit: bf,
    impactSet: impact,
  };
}

function orbitTurningPoint({ projection }) {
  const o = projection?.orbit;
  if (!o?.available) return null;
  if (o.liquidityConflict) return { id: "orbit-liquidity", whyNowKey: "calendarOrbit.tp.liquidityConflict", ifYouWaitKey: "calendarOrbit.tp.liquidityConflictWait" };
  if (o.belowBreathing) return { id: "orbit-below-breathing", whyNowKey: "calendarOrbit.tp.belowBreathing" };
  if (o.pastLatest) return { id: "orbit-past-latest", whyNowKey: "calendarOrbit.tp.pastLatest" };
  return null;
}

// ---------- SVG orbit ----------
const CO_W = 320;
const CO_H = 264;
const CX = 160;
const CY = 128;
const R = 96;

function polar(r, monthNum) {
  const deg = -90 + (monthNum - 1) * 30;
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad), deg };
}
function arcPath(r, startMonth, endMonth) {
  const s = polar(r, startMonth);
  const e = polar(r, endMonth);
  const sweep = ((e.deg - s.deg) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
}
function shiftMonth(m, by) {
  const s = /^\d{4}-\d{2}/.test(String(m ?? "")) ? String(m).slice(0, 7) : new Date().toISOString().slice(0, 7);
  const [y, mo] = s.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + by;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
function setMonthOfYear(m, targetMonthNum, nowMonthNum) {
  const s = /^\d{4}-\d{2}/.test(String(m ?? "")) ? String(m).slice(0, 7) : new Date().toISOString().slice(0, 7);
  let [y] = s.split("-").map(Number);
  if (targetMonthNum <= nowMonthNum) y += 1;
  return `${String(y).padStart(4, "0")}-${String(targetMonthNum).padStart(2, "0")}`;
}

function OrbitField({ t, orbit, tripMonthNum, nights, onTripMonth, onNights }) {
  const nowM = orbit.nowMonthNum;
  const balM = orbit.balanceMonthNum ?? nowM;
  const trip = polar(R, tripMonthNum ?? nowM);
  const nightsFrac = Math.max(0, Math.min(1, (nights - MIN_NIGHTS) / (MAX_NIGHTS - MIN_NIGHTS)));
  const nightHandle = polar(28 + nightsFrac * (R - 40), tripMonthNum ?? nowM);
  const fundArcR = R - 20;
  const fill = orbit.fundedFraction ?? 0;
  const paceClass = orbit.paceState === "ahead" || orbit.paceState === "on_track" ? "is-onpace" : orbit.paceState === "short" ? "is-short" : "is-unknown";

  return (
    <svg className="coField" viewBox={`0 0 ${CO_W} ${CO_H}`} role="group" aria-label={t("calendarOrbit.field.label")}>
      <circle cx={CX} cy={CY} r={R} className="coRing" />
      {Array.from({ length: 12 }, (_, i) => i + 1).map((mn) => {
        const p = polar(R, mn);
        const isPeak = orbit.season && [6, 12].includes(mn);
        return (
          <g key={mn}>
            <circle cx={p.x} cy={p.y} r={mn === nowM ? 3.5 : 2.5} className={`coTick ${isPeak ? "coTickPeak" : ""} ${mn === nowM ? "coTickNow" : ""}`} />
          </g>
        );
      })}

      {/* funding arc: now -> balance month, filled by what's on pace */}
      <path d={arcPath(fundArcR, nowM, balM === nowM ? nowM + 0.01 : balM)} className="coFundTrack" />
      {fill > 0 ? (
        <path
          d={arcPath(fundArcR, nowM, nowM + Math.max(0.01, ((((balM - nowM) % 12) + 12) % 12 || 12) * fill))}
          className={`coFundFill ${paceClass}`}
        />
      ) : null}

      {/* now marker */}
      <circle cx={polar(R, nowM).x} cy={polar(R, nowM).y} r="5" className="coNow" />
      <text x={polar(R + 14, nowM).x} y={polar(R + 14, nowM).y} className="coSmall" textAnchor="middle">{t("calendarOrbit.field.now")}</text>

      {/* deposit + balance markers */}
      <rect x={polar(R, nowM).x - 3} y={polar(R, nowM).y - 3} width="6" height="6" className="coDeposit" />
      {orbit.balanceMonthNum != null ? (
        <rect x={polar(R, balM).x - 3.5} y={polar(R, balM).y - 3.5} width="7" height="7" className="coBalance" transform={`rotate(45 ${polar(R, balM).x} ${polar(R, balM).y})`} />
      ) : null}

      {/* radial line + nights handle */}
      <line x1={CX} y1={CY} x2={trip.x} y2={trip.y} className="coSpoke" />
      <g
        className="coNights"
        role="slider"
        tabIndex={0}
        aria-label={t("calendarOrbit.field.nights", { n: nights })}
        aria-valuemin={MIN_NIGHTS}
        aria-valuemax={MAX_NIGHTS}
        aria-valuenow={nights}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onNights(Math.max(MIN_NIGHTS, nights - 1));
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") onNights(Math.min(MAX_NIGHTS, nights + 1));
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * CO_W - CX;
          const y = ((e.clientY - r.top) / r.height) * CO_H - CY;
          const dist = Math.min(R - 12, Math.max(0, Math.hypot(x, y) - 28));
          const frac = dist / (R - 40);
          onNights(Math.round(MIN_NIGHTS + frac * (MAX_NIGHTS - MIN_NIGHTS)));
        }}
      >
        <circle cx={nightHandle.x} cy={nightHandle.y} r="7" className="coNightsKnot" />
      </g>

      {/* trip knob - drag around the ring to change the month */}
      <g
        className="coTrip"
        role="slider"
        tabIndex={0}
        aria-label={t("calendarOrbit.field.tripMonth")}
        aria-valuemin={1}
        aria-valuemax={36}
        aria-valuenow={orbit.monthsUntilTrip ?? 1}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onTripMonth(-1);
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") onTripMonth(1);
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * CO_W - CX;
          const y = ((e.clientY - r.top) / r.height) * CO_H - CY;
          let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
          deg = ((deg % 360) + 360) % 360;
          const mn = (Math.round(deg / 30) % 12) + 1;
          onTripMonth({ month: mn });
        }}
      >
        <circle cx={trip.x} cy={trip.y} r="11" className="coTripKnot" />
        <text x={trip.x} y={trip.y + 3.5} className="coTripLabel" textAnchor="middle">{tripMonthNum ?? "?"}</text>
      </g>

      <text x={CX} y={CY - 8} className="coCentreValue" textAnchor="middle">{sgd(orbit.tripCostRange.expected)}</text>
      <text x={CX} y={CY + 10} className="coCentreSub" textAnchor="middle">{range(orbit.tripCostRange)}</text>
      {orbit.perTravellerRange ? (
        <text x={CX} y={CY + 26} className="coCentreSub" textAnchor="middle">{t("calendarOrbit.perTraveller", { amount: sgd(orbit.perTravellerRange.expected) })}</text>
      ) : null}
    </svg>
  );
}

function CalendarOrbitInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [server, setServer] = useState(null);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/calendar-orbit${bid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setServer(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.serverBranch?.id]);

  const m = useMemo(() => (reality ? merged(reality, s.branchVars) : null), [reality, s.branchVars]);
  const orbit = useMemo(
    () => (reality ? computeCalendarOrbit({ planData: orbitPlanFrom(reality, s.branchVars), context: orbitCtxFrom(reality, s.context) }) : null),
    [reality, s.branchVars, s.context],
  );
  const proj = s.projection?.orbit?.available ? s.projection.orbit : orbit;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("calendarOrbit.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !proj?.available || !m) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("calendarOrbit.title")}</h1></header>
        <p className="wlpEmpty">{t("calendarOrbit.noPlan")}</p>
      </section>
    );
  }

  const tripMonthNum = proj.tripMonthNum;
  const nights = Number(m.nights) || MIN_NIGHTS;
  const monthly = Number(m.monthly_contribution) || 0;
  const budgetCeil = Number(m.total_budget) || Math.max(proj.tripCostRange.expected, proj.planTotal);
  const set = (k, v) => s.setVar(k, v);

  const onTripMonth = (arg) => {
    if (arg && typeof arg === "object" && arg.month != null) {
      set("trip_month", setMonthOfYear(m.trip_month, arg.month, proj.nowMonthNum));
    } else {
      set("trip_month", shiftMonth(m.trip_month, arg));
    }
  };

  return (
    <section className="screen wlpScreen lsSceneScreen coScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("calendarOrbit.title")}</h1>
        <p>{t("calendarOrbit.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }, { id: "retirement" }]}
        realitySummary={t("calendarOrbit.summaryLine", { cost: range(proj.tripCostRange), month: reality.trip_month || t("calendarOrbit.unknown.trip_month") })}
        sealMonthlyAmount={monthly || proj.requiredMonthly || 0}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "shape", label: t("calendarOrbit.row.shape"), value: t("calendarOrbit.row.shapeValue", { people: reality.travellers, nights: reality.nights }), provenance: t("calendarOrbit.prov.fromPlan") },
          { id: "cost", label: t("calendarOrbit.row.cost"), value: range(proj.tripCostRange), provenance: t("calendarOrbit.prov.referenceRate") },
          { id: "season", label: t("calendarOrbit.row.season"), value: t(`calendarOrbit.season.${proj.season.key}`), provenance: t("calendarOrbit.prov.transparent") },
          { id: "pace", label: t("calendarOrbit.row.pace"), value: proj.requiredMonthly != null ? `${sgd(proj.requiredMonthly)}/mo` : t("calendarOrbit.unknown.current_savings"), provenance: t("calendarOrbit.prov.backwards") },
        ]}
        realityUnknowns={(server?.unknowns ?? proj.unknowns ?? []).map((u) => ({ id: u, label: t(`calendarOrbit.unknown.${u}`) }))}
        realityNote={t("calendarOrbit.estimateNote")}
      >
        <div className="coSurface">
          <OrbitField
            t={t}
            orbit={proj}
            tripMonthNum={tripMonthNum}
            nights={nights}
            onTripMonth={onTripMonth}
            onNights={(n) => set("nights", Math.max(MIN_NIGHTS, Math.min(MAX_NIGHTS, n)))}
          />

          <p className={`coPace co-${proj.paceState}`}>{t(`calendarOrbit.pace.${proj.paceState}`, { need: proj.requiredMonthly != null ? sgd(proj.requiredMonthly) : "—", have: sgd(monthly) })}</p>
          {proj.season.key !== "off" ? <p className="coSeasonNote">{t(`calendarOrbit.seasonNote.${proj.season.key}`, { mult: proj.season.highMult })}</p> : null}
          {proj.budgetGap > 0 ? <p className="wlpWarn">{t("calendarOrbit.belowCost", { amount: sgd(proj.budgetGap) })}</p> : null}
          {server?.projection?.decisionEcho ? <p className="coEcho">{t("calendarOrbit.decisionEcho")}</p> : null}

          <button type="button" className="lsGhostBtn" aria-expanded={showControls} onClick={() => setShowControls((x) => !x)}>
            {t(showControls ? "calendarOrbit.hideControls" : "calendarOrbit.showControls")}
          </button>
          {showControls ? (
            <div className="coControls">
              <div className="coCtlRow">
                <span>{t("calendarOrbit.node.comfort")}</span>
                <div className="toSeg">
                  {COMFORT.map((c) => (
                    <button key={c} type="button" className={m.comfort_tier === c ? "is-on" : ""} onClick={() => set("comfort_tier", c)}>{t(`calendarOrbit.comfort.${c}`)}</button>
                  ))}
                </div>
              </div>
              <div className="coCtlRow">
                <span>{t("calendarOrbit.node.destination")}</span>
                <div className="toSeg">
                  {DEST.map((d) => (
                    <button key={d} type="button" className={m.destination_type === d ? "is-on" : ""} onClick={() => set("destination_type", d)}>{t(`calendarOrbit.dest.${d}`)}</button>
                  ))}
                </div>
              </div>
              <label className="coCtlRow">
                <span>{t("calendarOrbit.node.people")}</span>
                <div className="toStepper">
                  <button type="button" onClick={() => set("travellers", Math.max(1, Number(m.travellers) - 1))} aria-label={t("calendarOrbit.fewer")}>−</button>
                  <b>{m.travellers}</b>
                  <button type="button" onClick={() => set("travellers", Number(m.travellers) + 1)} aria-label={t("calendarOrbit.more")}>+</button>
                </div>
              </label>
              <label className="coCtlRow">
                <span>{t("calendarOrbit.node.monthly")}</span>
                <div className="toStepper">
                  <button type="button" onClick={() => set("monthly_contribution", Math.max(0, monthly - 50))} aria-label={t("calendarOrbit.fewer")}>−</button>
                  <b>{sgd(monthly)}</b>
                  <button type="button" onClick={() => set("monthly_contribution", monthly + 50)} aria-label={t("calendarOrbit.more")}>+</button>
                </div>
              </label>
              <label className="coCtlRow">
                <span>{t("calendarOrbit.node.budget")}</span>
                <div className="toStepper">
                  <button type="button" onClick={() => set("total_budget", Math.max(proj.tripCostRange.low, budgetCeil - 200))} aria-label={t("calendarOrbit.fewer")}>−</button>
                  <b>{sgd(budgetCeil)}</b>
                  <button type="button" onClick={() => set("total_budget", budgetCeil + 200)} aria-label={t("calendarOrbit.more")}>+</button>
                </div>
              </label>
            </div>
          ) : null}

          <div className="rpMirror">
            <button type="button" onClick={() => onTripMonth(1)}>{t("calendarOrbit.mirror.later")}</button>
            <button type="button" onClick={() => onTripMonth(-1)}>{t("calendarOrbit.mirror.sooner")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("calendarOrbit.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function CalendarOrbit({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="travel" projectFn={projectCalendarOrbitScene} turningPointFor={orbitTurningPoint}>
      <CalendarOrbitInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
