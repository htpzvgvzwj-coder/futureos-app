"use client";

// Home Horizon - the Home Studio's flagship native scene.
//
// Not a loan calculator and not a list of house cards. A horizon line is
// the time axis; the Home Knot sits on it at (purchase month, price). Drag
// it left/right to move the month (the required monthly amount back-solves);
// drag it up/down to move the price (down payment, fees, loan, repayment
// and the post-purchase life all recompute). The Emergency floor is a
// Guardian Rail the plan may not silently cross. Wedding / Loan /
// Retirement are ghost tensions in the same picture.
//
// All numbers come from lib/home/horizon-finance.js (the real Singapore
// MAS/IRAS math) and the server impactSet from /api/home-horizon - the
// client never guesses an impact.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeHomeHorizon, safePriceForMonth } from "../../../lib/home/horizon-finance.js";
import { projectHomeImpact } from "../../../lib/home/horizon-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
function shiftMonth(m, by) {
  const s = /^\d{4}-\d{2}/.test(String(m ?? "")) ? String(m).slice(0, 7) : new Date().toISOString().slice(0, 7);
  const [y, mo] = s.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + by;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
function monthsFromNow(m) {
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return 0;
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  const now = new Date();
  return y * 12 + (mo - 1) - (now.getUTCFullYear() * 12 + now.getUTCMonth());
}
function fmtMonth(m) {
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return "—";
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-SG", { month: "short", year: "numeric" });
}

const HOME_VARS = ["estimated_price", "target_complete_month", "property_type", "down_payment_ratio", "loan_tenure", "rate_assumption", "renovation_reserve", "keep_emergency_months", "partner_contribution"];
function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of HOME_VARS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}

// pure projectFn for LivingSceneProvider - instant drag feedback that shares
// the SAME engine the server uses.
export function projectHome({ branchVars, reality, context }) {
  const b = merged(reality, branchVars);
  const projCtx = {
    committedMonthlyTotalExcludingHome: Number(context?.committedMonthlyTotal) || 0,
    emergencyBufferMonths: context?.emergencyBufferMonths ?? null,
    weddingActive: Boolean(context?.weddingActive),
    retirementActive: Boolean(context?.retirementActive),
  };
  const rf = computeHomeHorizon({ planData: reality, context: projCtx });
  const bf = computeHomeHorizon({ planData: b, context: projCtx });
  if (!rf.available || !bf.available) return {};
  const impact = projectHomeImpact({ branchData: b, realityData: reality, context: projCtx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: fmtGoal(g) }));
  return {
    selfOutcome: { metric: "monthsToReady", before: rf.readiness.monthsToReady, after: bf.readiness.monthsToReady, unit: "months", dir: (bf.readiness.monthsToReady ?? 0) < (rf.readiness.monthsToReady ?? 0) ? "down" : (bf.readiness.monthsToReady ?? 0) > (rf.readiness.monthsToReady ?? 0) ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    horizon: bf,
    impactSet: impact,
  };
}

function fmtGoal(g) {
  if (g.goalId === "emergency") return `${g.possibleAfter}mo buffer`;
  if (g.goalId === "loan") return `${sgd(g.possibleAfter)}/mo room`;
  if (g.goalId === "investment") return g.possibleAfter < 0 ? `${sgd(-g.possibleAfter)} short` : `${sgd(g.possibleAfter)} liquid`;
  return g.direction;
}

function homeTurningPoint({ projection }) {
  const h = projection?.horizon;
  if (!h?.available) return null;
  if (h.afterlife.belowEmergencyFloor) {
    return { id: "home-below-floor", whyNowKey: "homeHorizon.tp.belowFloor", ifYouWaitKey: "homeHorizon.tp.belowFloorWait" };
  }
  if (!h.regulatory.withinCeiling) {
    return { id: "home-over-ceiling", whyNowKey: "homeHorizon.tp.overCeiling", whyNowParams: { factor: h.regulatory.limitingFactor } };
  }
  return null;
}

// ---------- the SVG horizon field ----------
const FIELD_W = 320;
const FIELD_H = 210;
const GROUND_Y = 120; // horizon line
const MONTHS_SPAN = 60; // 5 years across the width
const PRICE_MIN = 200000;
const PRICE_MAX = 1400000;

function priceToY(price) {
  const t = (Math.min(PRICE_MAX, Math.max(PRICE_MIN, price)) - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
  return GROUND_Y - t * 90; // higher price -> higher on screen (further from ground)
}
function yToPrice(y) {
  const t = (GROUND_Y - y) / 90;
  return Math.round((PRICE_MIN + t * (PRICE_MAX - PRICE_MIN)) / 5000) * 5000;
}
function monthsToX(months) {
  return 12 + (Math.min(MONTHS_SPAN, Math.max(0, months)) / MONTHS_SPAN) * (FIELD_W - 24);
}
function xToMonths(x) {
  return Math.round(((x - 12) / (FIELD_W - 24)) * MONTHS_SPAN);
}

function HorizonField({ t, price, month, safePrice, horizon, onPrice, onMonth }) {
  const ref = useRef(null);
  const kx = monthsToX(monthsFromNow(month));
  const ky = priceToY(price);
  const safeY = safePrice ? priceToY(safePrice) : null;

  const fromClient = useCallback(
    (clientX, clientY) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * FIELD_W;
      const y = ((clientY - r.top) / r.height) * FIELD_H;
      onMonth(shiftMonth(new Date().toISOString().slice(0, 7), Math.max(1, xToMonths(x))));
      onPrice(yToPrice(y));
    },
    [onMonth, onPrice],
  );

  return (
    <svg
      ref={ref}
      className="hhField"
      viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
      role="group"
      aria-label={t("homeHorizon.field.label")}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        fromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.buttons === 1 && fromClient(e.clientX, e.clientY)}
    >
      {/* sky / ground */}
      <rect x="0" y="0" width={FIELD_W} height={GROUND_Y} className="hhSky" />
      <rect x="0" y={GROUND_Y} width={FIELD_W} height={FIELD_H - GROUND_Y} className="hhGround" />
      <line x1="0" y1={GROUND_Y} x2={FIELD_W} y2={GROUND_Y} className="hhHorizonLine" />

      {/* Emergency Rail (Guardian Rail) */}
      {horizon?.available ? (
        <>
          <line x1="0" y1={GROUND_Y + 14} x2={FIELD_W} y2={GROUND_Y + 14} className={`hhRail ${horizon.afterlife.belowEmergencyFloor ? "is-crossed" : ""}`} />
          <text x="6" y={GROUND_Y + 26} className="hhRailLabel">{t("homeHorizon.field.emergencyRail", { months: horizon.afterlife.keepEmergencyMonths })}</text>
        </>
      ) : null}

      {/* Upfront Stack under ground */}
      {horizon?.available ? (
        <rect
          x={kx - 14}
          y={GROUND_Y}
          width="28"
          height={Math.min(FIELD_H - GROUND_Y, (horizon.upfrontStack.upfrontCashRequired.value / 400000) * (FIELD_H - GROUND_Y))}
          className="hhUpfront"
        />
      ) : null}

      {/* Safe Price Shadow (ghost knot) */}
      {safeY != null ? (
        <g className="hhSafeShadow" aria-hidden="true">
          <line x1={kx} y1={safeY} x2={kx} y2={ky} className="hhSafeLink" />
          <rect x={kx - 9} y={safeY - 9} width="18" height="18" rx="2" className="hhSafeHouse" />
        </g>
      ) : null}

      {/* the Home Knot */}
      <g
        className="hhKnot"
        role="slider"
        tabIndex={0}
        aria-label={t("homeHorizon.field.knot", { price: sgd(price), month: fmtMonth(month) })}
        aria-valuetext={`${sgd(price)}, ${fmtMonth(month)}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") onPrice(price + 10000);
          else if (e.key === "ArrowDown") onPrice(price - 10000);
          else if (e.key === "ArrowRight") onMonth(shiftMonth(month, 1));
          else if (e.key === "ArrowLeft") onMonth(shiftMonth(month, -1));
          else return;
          e.preventDefault();
        }}
      >
        <line x1={kx} y1={ky} x2={kx} y2={GROUND_Y} className="hhStem" />
        <polygon points={`${kx - 12},${ky} ${kx + 12},${ky} ${kx},${ky - 12}`} className="hhRoof" />
        <rect x={kx - 10} y={ky} width="20" height="14" className="hhBody" />
      </g>
    </svg>
  );
}

// ---------- the scene ----------
function HomeHorizonInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [serverThread, setServerThread] = useState(null);

  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/home-horizon${bid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setServerThread(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.serverBranch?.id]);

  const m = useMemo(() => (reality ? merged(reality, s.branchVars) : null), [reality, s.branchVars]);
  const proj = s.projection?.horizon?.available ? s.projection : null;
  const horizon = proj?.horizon ?? (m ? computeHomeHorizon({ planData: m, context: { committedMonthlyTotalExcludingHome: Number(s.context?.committedMonthlyTotal) || 0, emergencyBufferMonths: s.context?.emergencyBufferMonths ?? null } }) : null);

  const safePrice = useMemo(() => {
    if (!m?.target_complete_month) return serverThread?.projection?.safePriceForTargetMonth ?? null;
    return safePriceForMonth({
      purchaseMonth: m.target_complete_month,
      planData: m,
      context: { committedMonthlyTotalExcludingHome: Number(s.context?.committedMonthlyTotal) || 0, emergencyBufferMonths: s.context?.emergencyBufferMonths ?? null },
    });
  }, [m, s.context, serverThread]);

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("homeHorizon.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !m || !horizon?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("homeHorizon.title")}</h1></header>
        <p className="wlpEmpty">{t("homeHorizon.noPlan")}</p>
      </section>
    );
  }

  const price = Number(m.estimated_price) || horizon.price.value;
  const month = m.target_complete_month ?? reality.target_complete_month ?? shiftMonth(new Date().toISOString().slice(0, 7), 24);
  const setPrice = (v) => s.setVar("estimated_price", Math.max(PRICE_MIN, Math.min(PRICE_MAX, Math.round(v / 5000) * 5000)));
  const setMonth = (v) => s.setVar("target_complete_month", v);

  const upfront = horizon.upfrontStack;
  const after = horizon.afterlife;

  return (
    <section className="screen wlpScreen lsSceneScreen hhScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("homeHorizon.title")}</h1>
        <p>{t("homeHorizon.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "retirement" }, { id: "emergency" }]}
        realitySummary={t("homeHorizon.summaryLine", { price: sgd(price), month: fmtMonth(month) })}
        sealMonthlyAmount={horizon.readiness.monthlySavingsPace.value}
        formatSelf={(v) => (v == null ? "—" : t("homeHorizon.monthsAway", { n: v }))}
        realityRows={[
          { id: "upfront", label: t("homeHorizon.row.upfront"), value: sgd(upfront.upfrontCashRequired.value), provenance: t("homeHorizon.prov.estimate") },
          { id: "monthly", label: t("homeHorizon.row.monthly"), value: `${sgd(horizon.loan.monthlyRepayment.value)}/mo`, provenance: t("homeHorizon.prov.amortization") },
          { id: "ready", label: t("homeHorizon.row.ready"), value: horizon.readiness.readyMonth ? fmtMonth(horizon.readiness.readyMonth) : "—", provenance: t("homeHorizon.prov.savingsPace") },
          { id: "rules", label: t("homeHorizon.row.rules"), value: horizon.regulatory.withinCeiling ? t("homeHorizon.rules.within") : t("homeHorizon.rules.over", { factor: horizon.regulatory.limitingFactor }), provenance: t("homeHorizon.prov.rulesAsOf", { date: horizon.regulatory.asOf }) },
        ]}
        realityUnknowns={(serverThread?.unknowns ?? []).map((u) => ({ id: u, label: t(`homeHorizon.unknown.${u}`) }))}
        realityNote={t("homeHorizon.estimateNote")}
      >
        <div className="hhSurface">
          <HorizonField
            t={t}
            price={price}
            month={month}
            safePrice={safePrice}
            horizon={horizon}
            onPrice={setPrice}
            onMonth={setMonth}
          />

          <div className="hhReadouts">
            <div className={`hhReadout ${after.belowEmergencyFloor ? "is-worse" : ""}`}>
              <span>{t("homeHorizon.read.buffer")}</span>
              <b>{after.postPurchaseEmergencyMonths != null ? t("homeHorizon.months", { n: after.postPurchaseEmergencyMonths }) : "—"}</b>
            </div>
            <div className={`hhReadout ${after.monthlyBreathingRoom.value < 0 ? "is-worse" : ""}`}>
              <span>{t("homeHorizon.read.breathing")}</span>
              <b>{sgd(after.monthlyBreathingRoom.value)}/mo</b>
            </div>
          </div>

          {/* Rate Weather */}
          <div className="hhRateWeather">
            <span>{t("homeHorizon.rateWeather.label", { rate: horizon.loan.rateAssumption.value })}</span>
            <b>{sgd(horizon.loan.repaymentRange.low)}–{sgd(horizon.loan.repaymentRange.high)}/mo</b>
            <em>{t("homeHorizon.rateWeather.note")}</em>
          </div>

          {/* Safe Price Shadow readout */}
          {safePrice ? (
            <p className="hhSafeReadout">
              {t("homeHorizon.safePrice", { price: sgd(safePrice), month: fmtMonth(month) })}
              {price > safePrice ? ` · ${t("homeHorizon.aboveSafe", { amount: sgd(price - safePrice) })}` : ""}
            </p>
          ) : null}

          <div className="hhSteppers">
            <div className="toStepper">
              <button type="button" onClick={() => setPrice(price - 25000)} aria-label={t("homeHorizon.lowerPrice")}>−</button>
              <b>{sgd(price)}</b>
              <button type="button" onClick={() => setPrice(price + 25000)} aria-label={t("homeHorizon.raisePrice")}>+</button>
            </div>
            <div className="toStepper">
              <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("homeHorizon.earlier")}>−</button>
              <b>{fmtMonth(month)}</b>
              <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("homeHorizon.later")}>+</button>
            </div>
          </div>

          <button type="button" className="lsGhostBtn hhStackBtn" aria-expanded={sheetOpen} onClick={() => setSheetOpen((o) => !o)}>
            {t("homeHorizon.openStack")}
          </button>
          {sheetOpen ? (
            <div className="hhStackSheet">
              <h4>{t("homeHorizon.stack.title")}</h4>
              <dl>
                {[
                  ["downPayment", upfront.downPayment],
                  ["buyerStampDuty", upfront.buyerStampDuty],
                  ["additionalBSD", upfront.additionalBSD],
                  ["legalFees", upfront.legalFees],
                  ["valuationFee", upfront.valuationFee],
                  ["mortgageStamp", upfront.mortgageStamp],
                  ["renovationReserve", upfront.renovationReserve],
                  ["cpfApplied", upfront.cpfApplied],
                  ["partnerApplied", upfront.partnerApplied],
                ].map(([k, f]) => (
                  <div key={k}>
                    <dt>{t(`homeHorizon.stack.${k}`)}</dt>
                    <dd>
                      {f.value == null ? t("homeHorizon.stack.unknown") : sgd(f.value)}
                      <span className={`hhProv hhProv-${f.provenance}`}>{t(`homeHorizon.prov.${f.provenance}`)}</span>
                    </dd>
                  </div>
                ))}
                <div className="hhStackTotal">
                  <dt>{t("homeHorizon.stack.total")}</dt>
                  <dd>{sgd(upfront.upfrontCashRequired.value)}</dd>
                </div>
              </dl>
              {/* Home Afterlife */}
              <h4>{t("homeHorizon.afterlife.title")}</h4>
              <p className="hhAfterlife">
                {t("homeHorizon.afterlife.body", {
                  buffer: after.postPurchaseEmergencyMonths != null ? t("homeHorizon.months", { n: after.postPurchaseEmergencyMonths }) : t("homeHorizon.stack.unknown"),
                  breathing: sgd(after.monthlyBreathingRoom.value),
                })}
              </p>
            </div>
          ) : null}

          {/* Mirror branches - two real alternatives */}
          <div className="rpMirror">
            <button type="button" onClick={() => { setPrice(safePrice ? Math.min(price, safePrice) : price); }}>{t("homeHorizon.mirror.safePrice")}</button>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 12))}>{t("homeHorizon.mirror.wait12")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("homeHorizon.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function HomeHorizon({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="home" projectFn={projectHome} turningPointFor={homeTurningPoint}>
      <HomeHorizonInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
