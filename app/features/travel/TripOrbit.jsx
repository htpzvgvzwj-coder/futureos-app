"use client";

// TripOrbitScene - the Travel Studio's native surface.
//
// The Trip Window sits at the centre; Date, People, Comfort, Budget orbit
// it, each directly adjustable. Every change recomputes the real
// reference-rate cost (never a quote), the payment nodes, and the freed
// cashflow when the trip shrinks or shifts - which becomes a Released
// Future the customer places. Guardian here only ever watches payment
// windows; it never books anything.

import { useMemo } from "react";
import { computeTravelPlanFinance } from "../../../lib/travel/plan-finance.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";
import { DragTrack } from "../../components/living-scene/DragTrack.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const COMFORT = ["budget", "mid", "premium"];
const DEST = ["domestic", "regional", "longhaul"];
const TRAVEL_KEYS = ["travellers", "nights", "comfort_tier", "destination_type", "trip_month", "total_budget", "monthly_contribution"];

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of TRAVEL_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}

// pure - shares computeTravelPlanFinance with lib/future-field/adapters.js
export function projectTrip({ branchVars, reality }) {
  const rf = computeTravelPlanFinance({ planData: reality });
  const bf = computeTravelPlanFinance({ planData: merged(reality, branchVars) });
  if (!rf.available || !bf.available) return {};
  const monthlyBefore = rf.userRequiredMonthly ?? rf.userMonthly ?? 0;
  const monthlyAfter = bf.userRequiredMonthly ?? bf.userMonthly ?? 0;
  const addedPressure = Math.max(0, monthlyAfter - monthlyBefore);
  const freedCashflow = Math.max(0, monthlyBefore - monthlyAfter);
  const costDir = bf.planTotal < rf.planTotal ? "down" : bf.planTotal > rf.planTotal ? "up" : "flat";

  const nodes = [];
  if (freedCashflow > 0) {
    nodes.push({ id: "emergency", dir: "up" });
    nodes.push({ id: "home", dir: "up" });
  } else if (addedPressure > 0) {
    nodes.push({ id: "emergency", dir: "down" });
    nodes.push({ id: "home", dir: "down" });
  }

  return {
    selfOutcome: { metric: "planBudget", before: rf.planTotal, after: bf.planTotal, unit: "sgd", dir: costDir },
    nodes,
    freedCashflow,
    addedPressure,
    mode: freedCashflow > 0 ? "freed" : addedPressure > 0 ? "pressure" : "neutral",
    planTotalAfter: bf.planTotal,
    perTravellerAfter: bf.perTraveller,
    requiredMonthlyAfter: bf.userRequiredMonthly,
    budgetGapAfter: bf.budgetGap,
    sealableAfter: bf.sealable,
  };
}

function shiftMonth(m, by) {
  const s = /^\d{4}-\d{2}/.test(String(m ?? "")) ? String(m).slice(0, 7) : new Date().toISOString().slice(0, 7);
  const [y, mo] = s.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + by;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function TripOrbitInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;

  const m = useMemo(() => (reality ? merged(reality, s.branchVars) : null), [reality, s.branchVars]);

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("tripOrbit.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !m) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("tripOrbit.title")}</h1></header>
        <p className="wlpEmpty">{t("tripOrbit.noPlan")}</p>
      </section>
    );
  }

  const proj = s.projection?.planTotalAfter != null ? s.projection : null;
  const planTotal = proj?.planTotalAfter ?? feas.planTotal;
  const perTraveller = proj?.perTravellerAfter ?? feas.perTraveller;
  const requiredMonthly = proj?.requiredMonthlyAfter ?? feas.userRequiredMonthly;
  const budgetGap = proj?.budgetGapAfter ?? feas.budgetGap;
  const budgetCeil = Number(m.total_budget) || Math.max(feas.computedCoreTotal, planTotal);
  const monthly = Number(m.monthly_contribution) || 0;
  const set = (k, v) => s.setVar(k, v);

  return (
    <section className="screen wlpScreen lsSceneScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("tripOrbit.title")}</h1>
        <p>{t("tripOrbit.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalLabel={t("livingScene.node.home")}
        sealMonthlyAmount={requiredMonthly || monthly}
        sealDisabled={proj ? proj.sealableAfter === false : feas.sealable === false}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "shape", label: t("tripOrbit.reality.shape"), value: t("tripOrbit.reality.shapeValue", { people: reality.travellers, nights: reality.nights }), provenance: t("tripOrbit.reality.fromPlan") },
          { id: "cost", label: t("tripOrbit.reality.cost"), value: sgd(feas.computedCoreTotal), provenance: t("tripOrbit.reality.referenceRate") },
          { id: "month", label: t("tripOrbit.reality.month"), value: reality.trip_month || "—", provenance: t("tripOrbit.reality.fromPlan") },
        ]}
        realityNote={t("tripOrbit.estimateNote")}
      >
        <div className="toScene">
          <div className="toOrbit">
            <div className="toCentre">
              <span>{t("tripOrbit.window")}</span>
              <b>{sgd(planTotal)}</b>
              <em>{perTraveller ? t("tripOrbit.perTraveller", { amount: sgd(perTraveller) }) : ""}</em>
            </div>
            <div className="toNode toNode-people">
              <span>{t("tripOrbit.node.people")}</span>
              <div className="toStepper">
                <button type="button" onClick={() => set("travellers", Math.max(1, Number(m.travellers) - 1))} aria-label={t("tripOrbit.fewer")}>−</button>
                <b>{m.travellers}</b>
                <button type="button" onClick={() => set("travellers", Number(m.travellers) + 1)} aria-label={t("tripOrbit.more")}>+</button>
              </div>
            </div>
            <div className="toNode toNode-nights">
              <span>{t("tripOrbit.node.nights")}</span>
              <div className="toStepper">
                <button type="button" onClick={() => set("nights", Math.max(1, Number(m.nights) - 1))} aria-label={t("tripOrbit.fewer")}>−</button>
                <b>{m.nights}</b>
                <button type="button" onClick={() => set("nights", Number(m.nights) + 1)} aria-label={t("tripOrbit.more")}>+</button>
              </div>
            </div>
            <div className="toNode toNode-comfort">
              <span>{t("tripOrbit.node.comfort")}</span>
              <div className="toSeg">
                {COMFORT.map((c) => (
                  <button key={c} type="button" className={m.comfort_tier === c ? "is-on" : ""} onClick={() => set("comfort_tier", c)}>
                    {t(`tripOrbit.comfort.${c}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="toNode toNode-date">
              <span>{t("tripOrbit.node.date")}</span>
              <div className="toStepper">
                <button type="button" onClick={() => set("trip_month", shiftMonth(m.trip_month, -1))} aria-label={t("tripOrbit.earlier")}>−</button>
                <b>{m.trip_month || "—"}</b>
                <button type="button" onClick={() => set("trip_month", shiftMonth(m.trip_month, 1))} aria-label={t("tripOrbit.later")}>+</button>
              </div>
            </div>
          </div>

          <div className="toDest">
            {DEST.map((d) => (
              <button key={d} type="button" className={m.destination_type === d ? "is-on" : ""} onClick={() => set("destination_type", d)}>
                {t(`tripOrbit.dest.${d}`)}
              </button>
            ))}
          </div>

          <label className="toSlider">
            <span>{t("tripOrbit.node.budget")}</span>
            <DragTrack min={feas.computedCoreTotal} max={Math.max(feas.computedCoreTotal * 2, budgetCeil)} step={100} value={budgetCeil} onChange={(v) => set("total_budget", v)} ariaLabel={t("tripOrbit.node.budget")} />
            <b>{sgd(budgetCeil)}</b>
          </label>
          {budgetGap > 0 ? <p className="wlpWarn">{t("tripOrbit.belowCost", { amount: sgd(budgetGap) })}</p> : null}

          <label className="toSlider">
            <span>{t("tripOrbit.monthly")}</span>
            <DragTrack min={0} max={Math.max(requiredMonthly ? requiredMonthly * 2 : 1000, monthly * 2, 500)} step={10} value={monthly} onChange={(v) => set("monthly_contribution", v)} ariaLabel={t("tripOrbit.monthly")} />
            <b>{sgd(monthly)}/mo</b>
          </label>
          {requiredMonthly ? <p className="wlpMuted">{t("tripOrbit.needMonthly", { amount: sgd(requiredMonthly) })}</p> : null}

          <div className="rpMirror">
            <button type="button" onClick={() => s.resetBranch()}>{t("tripOrbit.mirror.keepExperience")}</button>
            <button type="button" onClick={() => set("trip_month", shiftMonth(reality.trip_month, 6))}>{t("tripOrbit.mirror.shiftWindow")}</button>
            <button type="button" onClick={() => { set("comfort_tier", "budget"); set("nights", Math.max(1, Number(reality.nights) - 2)); }}>{t("tripOrbit.mirror.preserveCommitments")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function TripOrbit({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="travel" projectFn={projectTrip}>
      <TripOrbitInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
