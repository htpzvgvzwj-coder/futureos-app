"use client";

// Debt Gravity - the Loan Studio's flagship native scene.
//
// Not a repayment table. Each real debt is a Gravity Body sized by its
// confirmed balance; monthly cashflow is pulled toward the target; the
// payoff point is a draggable Release Knot; and the monthly payment that
// comes back after payoff is a Future Handoff - shown as a ghost before it
// is real, and never auto-routed.

import { useEffect, useMemo, useState } from "react";
import { computeDebtGravity, requiredExtraForPayoffMonth } from "../../../lib/loan/debt-gravity-finance.js";
import { projectDebtImpact } from "../../../lib/loan/debt-gravity-projector.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
function monthsToYears(m) {
  if (m == null) return "—";
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return y > 0 ? `${y}y ${mo}m` : `${mo}m`;
}
function fmtMonth(m) {
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return "—";
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-SG", { month: "short", year: "numeric" });
}


// The single confirmed loan as a one-body debts array (the multi-debt
// picture comes from /api/debt-gravity).
function debtsFromReality(reality) {
  const bal = Number(reality.loan_amount) || 0;
  if (!(bal > 0)) return [];
  return [{ id: reality.purpose ? `loan:${reality.purpose}` : "loan:primary", label: reality.purpose ?? "loan", kind: "loan", balance: bal, annualRatePercent: reality.annual_rate_percent ?? null, minimumMonthly: Number(reality.monthly_installment) || 0, feeConfirmed: reality.early_repayment_fee != null ? Number(reality.early_repayment_fee) : null, provenance: "bank_confirmed" }];
}
function gravityPlan(reality, branchVars) {
  return {
    target_debt: branchVars.target_debt ?? (reality.purpose ? `loan:${reality.purpose}` : "loan:primary"),
    extra_monthly: Number(branchVars.extra_repayment ?? reality.extra_repayment) || 0,
    one_off_payment: Number(branchVars.one_off_payment) || 0,
    breathing_room_floor: Number(branchVars.breathing_room_floor) || 0,
    excluded_debt_ids: [],
  };
}
function gravityCtx(reality, sceneContext) {
  return {
    monthlyIncome: Number(reality.monthly_income) || 0,
    monthlyExpenses: Number(reality.monthly_expenses) || 0,
    otherGoalsMonthlyOutflow: Number(reality.other_goals_monthly_outflow) || 0,
    emergencyBufferMonths: sceneContext?.emergencyBufferMonths ?? null,
    currentSavings: Number(reality.current_savings) || 0,
    protectedSavings: 0,
  };
}

export function projectLoanGravity({ branchVars, reality, context, serverDebts }) {
  const debts = serverDebts?.length ? serverDebts : debtsFromReality(reality);
  const ctx = gravityCtx(reality, context);
  const rf = computeDebtGravity({ debts, planData: gravityPlan(reality, {}), context: ctx });
  const bf = computeDebtGravity({ debts, planData: gravityPlan(reality, branchVars), context: ctx });
  if (!rf.available || !bf.available) return {};
  const impact = projectDebtImpact({ branchPlan: gravityPlan(reality, branchVars), realityPlan: gravityPlan(reality, {}), debts, context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "loan" ? `${sgd(g.possibleAfter)}/mo room` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  const tgt = bf.bodies.find((b) => b.isTarget) ?? bf.bodies[0];
  const rtgt = rf.bodies.find((b) => b.isTarget) ?? rf.bodies[0];
  return {
    selfOutcome: { metric: "monthsToDebtFree", before: rtgt.monthsToPayoff, after: tgt.monthsToPayoff, unit: "months", dir: (tgt.monthsToPayoff ?? 0) < (rtgt.monthsToPayoff ?? 0) ? "down" : (tgt.monthsToPayoff ?? 0) > (rtgt.monthsToPayoff ?? 0) ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    gravity: bf,
    impactSet: impact,
  };
}

function loanGravityTurningPoint({ projection }) {
  const g = projection?.gravity;
  if (!g?.available) return null;
  if (g.belowBreathingFloor) return { id: "gravity-below-breathing", whyNowKey: "debtGravity.tp.belowBreathing", ifYouWaitKey: "debtGravity.tp.belowBreathingWait" };
  const tgt = g.bodies.find((b) => b.isTarget);
  if (tgt && tgt.monthsToPayoff != null && tgt.monthsToPayoff <= 12) return { id: "gravity-near-payoff", whyNowKey: "debtGravity.tp.nearPayoff", whyNowParams: { label: tgt.label, months: tgt.monthsToPayoff } };
  return null;
}

// ---------- SVG gravity field ----------
const GF_W = 320;
const GF_H = 150;
const MAX_MONTHS = 84; // 7 years across the width
function monthsToX(m) {
  return 40 + (Math.min(MAX_MONTHS, Math.max(0, m)) / MAX_MONTHS) * (GF_W - 56);
}
function xToMonths(x) {
  return Math.round(((x - 40) / (GF_W - 56)) * MAX_MONTHS);
}
function balanceToR(bal, maxBal) {
  return 8 + (Math.sqrt(Math.min(bal, maxBal)) / Math.sqrt(maxBal || 1)) * 18;
}

function GravityField({ t, bodies, targetId, breathingRoom, breathingFloor, onKnotMonths, knotMonths, onSelectBody }) {
  const maxBal = Math.max(...bodies.map((b) => b.balance.value), 1);
  const knotX = monthsToX(knotMonths);

  return (
    <svg className="dgField" viewBox={`0 0 ${GF_W} ${GF_H}`} role="group" aria-label={t("debtGravity.field.label")}>
      {/* cashflow source pulled toward the debts */}
      <circle cx="18" cy="60" r="10" className="dgCashflow" />
      <text x="18" y="82" className="dgSmall" textAnchor="middle">{t("debtGravity.field.cashflow")}</text>

      {/* timeline */}
      <line x1="40" y1="118" x2={GF_W - 16} y2="118" className="dgAxis" />
      {[12, 24, 36, 48, 60, 72].map((mo) => (
        <text key={mo} x={monthsToX(mo)} y="132" className="dgSmall" textAnchor="middle">{mo / 12}y</text>
      ))}

      {/* Gravity Bodies */}
      {bodies.map((b, i) => {
        const bx = monthsToX(b.monthsToPayoff ?? MAX_MONTHS);
        const by = 40 + (i % 3) * 24;
        return (
          <g key={b.id} className={`dgBody ${b.id === targetId ? "is-target" : ""}`} onClick={() => onSelectBody(b.id)}>
            <line x1="28" y1="60" x2={bx} y2={by} className="dgPull" />
            <circle cx={bx} cy={by} r={balanceToR(b.balance.value, maxBal)} className={`dgBall ${b.kind === "card" ? "is-card" : ""}`}>
              <title>{b.label} · {sgd(b.balance.value)}</title>
            </circle>
            <text x={bx} y={by - balanceToR(b.balance.value, maxBal) - 3} className="dgSmall" textAnchor="middle">{b.label}</text>
          </g>
        );
      })}

      {/* Release Knot on the target's payoff position */}
      <g
        className="dgKnot"
        role="slider"
        tabIndex={0}
        aria-label={t("debtGravity.field.knot", { months: knotMonths })}
        aria-valuemin={1}
        aria-valuemax={MAX_MONTHS}
        aria-valuenow={knotMonths}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onKnotMonths(Math.max(1, knotMonths - 1));
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") onKnotMonths(Math.min(MAX_MONTHS, knotMonths + 1));
          else if (e.key === "PageDown") onKnotMonths(Math.max(1, knotMonths - 6));
          else if (e.key === "PageUp") onKnotMonths(Math.min(MAX_MONTHS, knotMonths + 6));
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * GF_W;
          onKnotMonths(Math.max(1, Math.min(MAX_MONTHS, xToMonths(x))));
        }}
      >
        <line x1={knotX} y1="24" x2={knotX} y2="118" className="dgKnotLine" />
        <polygon points={`${knotX - 7},24 ${knotX + 7},24 ${knotX},34`} className="dgKnotFlag" />
        <text x={knotX} y="16" className="dgSmall" textAnchor="middle">{t("debtGravity.field.freedom")}</text>
      </g>

      {/* Breathing room bar */}
      {breathingRoom != null ? (
        <g>
          <rect x="40" y="140" width={GF_W - 56} height="6" className="dgBreathTrack" />
          <rect x="40" y="140" width={Math.max(0, Math.min(1, (breathingRoom + Math.max(0, -breathingRoom)) / 3000)) * (GF_W - 56)} height="6" className={breathingRoom < breathingFloor ? "dgBreathFill is-low" : "dgBreathFill"} />
        </g>
      ) : null}
    </svg>
  );
}

function DebtGravityInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [server, setServer] = useState(null);
  const [openBody, setOpenBody] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const bid = s.serverBranch?.id ? `?branchId=${s.serverBranch.id}` : "";
    fetch(`/api/debt-gravity${bid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setServer(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s.serverBranch?.id]);

  const serverDebts = server?.reality?.debts ?? null;
  const proj = s.projection?.gravity?.available ? s.projection : null;
  // Re-run the domain finance engine on every branch-var change (memoised).
  const localGravity = useMemo(
    () => (reality ? computeDebtGravity({ debts: serverDebts?.length ? serverDebts : debtsFromReality(reality), planData: gravityPlan(reality, s.branchVars), context: gravityCtx(reality, s.context) }) : null),
    [reality, serverDebts, s.branchVars, s.context],
  );
  const gravity = proj?.gravity ?? localGravity;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("debtGravity.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !gravity?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("debtGravity.title")}</h1></header>
        <p className="wlpEmpty">{t("debtGravity.noDebt")}</p>
      </section>
    );
  }

  const target = gravity.bodies.find((b) => b.isTarget) ?? gravity.bodies[0];
  const extra = Number(s.branchVars.extra_repayment ?? reality.extra_repayment) || 0;
  const knotMonths = target.monthsToPayoff ?? 60;

  const setKnotMonths = (months) => {
    // drag the Release Knot -> back-solve the extra monthly needed
    const need = requiredExtraForPayoffMonth({ debt: { balance: target.balance.value, annualRatePercent: target.annualRatePercent.value, minimumMonthly: target.minimumMonthly.value }, byMonths: months });
    if (need != null) s.setVar("extra_repayment", need);
  };
  const setExtra = (v) => s.setVar("extra_repayment", Math.max(0, Math.round(v / 10) * 10));

  return (
    <section className="screen wlpScreen lsSceneScreen dgScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("debtGravity.title")}</h1>
        <p>{t("debtGravity.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }, { id: "retirement" }]}
        realitySummary={t("debtGravity.summaryLine", { label: target.label, debtFree: monthsToYears(target.monthsToPayoff) })}
        sealMonthlyAmount={target.minimumMonthly.value + extra}
        formatSelf={monthsToYears}
        realityRows={[
          { id: "balance", label: t("debtGravity.row.balance"), value: sgd(target.balance.value), provenance: t("debtGravity.prov.bank") },
          { id: "freedom", label: t("debtGravity.row.freedomDate"), value: fmtMonth(gravity.freedomDate), provenance: t("debtGravity.prov.amort") },
          { id: "released", label: t("debtGravity.row.released"), value: `${sgd(gravity.releasedMonthlyAtFreedom.value)}/mo`, provenance: t("debtGravity.prov.bank") },
          { id: "breathing", label: t("debtGravity.row.breathing"), value: gravity.breathingRoom.value != null ? `${sgd(gravity.breathingRoom.value)}/mo` : "—", provenance: t("debtGravity.prov.estimate") },
        ]}
        realityUnknowns={(server?.unknowns ?? gravity.unknowns ?? []).map((u) => ({ id: u, label: t("debtGravity.unknownGeneric", { id: u }) }))}
        realityNote={t("debtGravity.estimateNote")}
      >
        <div className="dgSurface">
          <GravityField
            t={t}
            bodies={gravity.bodies}
            targetId={gravity.targetDebtId}
            breathingRoom={gravity.breathingRoom.value}
            breathingFloor={gravity.breathingFloor}
            knotMonths={knotMonths}
            onKnotMonths={setKnotMonths}
            onSelectBody={(id) => { s.setVar("target_debt", id); setOpenBody(id); }}
          />

          <div className="dgReadouts">
            <div className={`dgReadout ${target.monthsToPayoff != null && target.baselineMonthsToPayoff != null && target.monthsToPayoff < target.baselineMonthsToPayoff ? "is-better" : ""}`}>
              <span>{t("debtGravity.read.debtFree")}</span>
              <b>{monthsToYears(target.monthsToPayoff)}</b>
              {target.monthsSaved > 0 ? <em>{t("debtGravity.read.saved", { m: target.monthsSaved })}</em> : null}
            </div>
            <div className={`dgReadout ${gravity.belowBreathingFloor ? "is-worse" : ""}`}>
              <span>{t("debtGravity.read.breathing")}</span>
              <b>{gravity.breathingRoom.value != null ? `${sgd(gravity.breathingRoom.value)}/mo` : "—"}</b>
            </div>
          </div>

          <label className="dgExtra">
            <span>{t("debtGravity.extraLabel")}</span>
            <input type="range" min="0" max={Math.max(2000, extra * 2, 1000)} step="10" value={extra} onChange={(e) => setExtra(Number(e.target.value))} aria-label={t("debtGravity.extraLabel")} />
            <b>{sgd(extra)}/mo</b>
          </label>

          {/* Future Handoff Preview - a ghost */}
          <div className="dgHandoffGhost">
            <p><b>{t("debtGravity.handoffPreview.title")}</b></p>
            <p>{t("debtGravity.handoffPreview.body", { amount: sgd(gravity.futureHandoffPreview.releasedMonthly), month: fmtMonth(gravity.futureHandoffPreview.whenMonth) })}</p>
            <p className="lsProvenance">{gravity.futureHandoffPreview.note}</p>
          </div>

          {/* Strategy comparison - never auto-selected */}
          {server?.projection?.strategyComparison ? (
            <>
              <button type="button" className="lsGhostBtn" aria-expanded={compareOpen} onClick={() => setCompareOpen((o) => !o)}>
                {t("debtGravity.compareStrategies")}
              </button>
              {compareOpen ? (
                <div className="dgStrategies">
                  {Object.entries(server.projection.strategyComparison.options).map(([k, v]) => (
                    <div key={k} className="dgStrategy">
                      <b>{t(`debtGravity.strategy.${k}`)}</b>
                      <span>{t("debtGravity.strategy.clearsIn", { m: v.clearedAllInMonths })} · {t("debtGravity.strategy.interest", { amount: sgd(v.totalInterest) })}</span>
                      <em>{v.reasoning}</em>
                    </div>
                  ))}
                  <p className="lsProvenance">{server.projection.strategyComparison.note}</p>
                </div>
              ) : null}
            </>
          ) : null}

          {openBody ? (
            <div className="dgBodySheet">
              {(() => {
                const b = gravity.bodies.find((x) => x.id === openBody);
                if (!b) return null;
                return (
                  <>
                    <h4>{b.label}</h4>
                    <dl>
                      <div><dt>{t("debtGravity.body.balance")}</dt><dd>{sgd(b.balance.value)}</dd></div>
                      <div><dt>{t("debtGravity.body.apr")}</dt><dd>{b.annualRatePercent.value != null ? `${b.annualRatePercent.value}%` : t("debtGravity.body.unknown")}</dd></div>
                      <div><dt>{t("debtGravity.body.minimum")}</dt><dd>{sgd(b.minimumMonthly.value)}/mo</dd></div>
                      <div><dt>{t("debtGravity.body.fee")}</dt><dd>{b.earlyRepaymentFee.value != null ? sgd(b.earlyRepaymentFee.value) : t("debtGravity.body.unknown")}</dd></div>
                    </dl>
                  </>
                );
              })()}
            </div>
          ) : null}

          <div className="rpMirror">
            <button type="button" onClick={() => setKnotMonths(12)}>{t("debtGravity.mirror.in12")}</button>
            <button type="button" onClick={() => setExtra(0)}>{t("debtGravity.mirror.minimumOnly")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("debtGravity.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function DebtGravity({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="loan" projectFn={projectLoanGravity} turningPointFor={loanGravityTurningPoint}>
      <DebtGravityInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
