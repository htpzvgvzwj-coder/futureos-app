"use client";

// RepaymentPathScene - the Loan Studio's native surface.
//
// Not four metrics and a generic canvas. Debt Weight and Breathing Room sit
// at the two ends of ONE draggable path. Dragging the monthly repayment:
//   - shifts the debt-free date (real reducing-balance amortization)
//   - changes Monthly Freedom
//   - pushes the Emergency / Home / Investment nodes
//   - never auto-allocates anything
// The three Mirror paths (Clear Faster / Preserve Breathing Room / Balanced)
// are one tap each. Everything below the path is the shared spine.

import { useMemo } from "react";
import { monthsToPayoff } from "../../../lib/living-plan/monthly-shift-projection.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";
import { DragTrack } from "../../components/living-scene/DragTrack.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function loanHeadroom(reality) {
  const income = Number(reality.monthly_income) || 0;
  const expenses = Number(reality.monthly_expenses) || 0;
  const installment = Number(reality.monthly_installment) || 0;
  const others = Number(reality.other_goals_monthly_outflow) || 0;
  return Math.max(100, Math.round((income - expenses - installment - others) / 10) * 10);
}

// pure - shares monthsToPayoff with lib/future-field/adapters.js loanAdapter
export function projectRepayment({ branchVars, reality }) {
  const principal = Number(reality.loan_amount) || 0;
  const rate = Number(reality.annual_rate_percent) || 0;
  const installment = Number(reality.monthly_installment) || 0;
  const income = Number(reality.monthly_income) || 0;
  const expenses = Number(reality.monthly_expenses) || 0;
  const baseExtra = Number(reality.extra_repayment) || 0;
  const extra = Math.max(0, Math.round(Number(branchVars.extra_repayment ?? baseExtra)));
  const totBefore = installment + baseExtra;
  const totAfter = installment + extra;
  const mBefore = monthsToPayoff({ principal, annualRatePercent: rate, monthlyPayment: totBefore });
  const mAfter = monthsToPayoff({ principal, annualRatePercent: rate, monthlyPayment: totAfter });
  const roomBefore = income > 0 ? Math.round(income - expenses - totBefore) : null;
  const roomAfter = income > 0 ? Math.round(income - expenses - totAfter) : null;
  const addedPressure = Math.max(0, totAfter - totBefore);
  const freedCashflow = Math.max(0, totBefore - totAfter);
  const dir = mAfter != null && mBefore != null ? (mAfter < mBefore ? "down" : mAfter > mBefore ? "up" : "flat") : "flat";

  const nodes = [];
  if (roomBefore != null) {
    nodes.push({ id: "breathingRoom", dir: roomAfter < roomBefore ? "down" : roomAfter > roomBefore ? "up" : "flat", note: `${sgd(roomAfter)}/mo` });
  }
  if (addedPressure > 0) {
    nodes.push({ id: "emergency", dir: "down" });
    nodes.push({ id: "home", dir: "down" });
    nodes.push({ id: "investment", dir: "down" });
  } else if (freedCashflow > 0) {
    nodes.push({ id: "emergency", dir: "up" });
  }

  return {
    selfOutcome: { metric: "monthsToDebtFree", before: mBefore, after: mAfter, unit: "months", dir },
    nodes,
    freedCashflow,
    addedPressure,
    mode: addedPressure > 0 ? "pressure" : freedCashflow > 0 ? "freed" : "neutral",
    monthlyPaymentAfter: totAfter,
    roomAfter,
    debtWeightPct: income > 0 ? Math.round((totAfter / income) * 100) : null,
    monthsAfter: mAfter,
  };
}

function loanTurningPoint({ projection }) {
  const room = projection.roomAfter;
  const weight = projection.debtWeightPct;
  if (room != null && room < 0) {
    return { id: "loan-overcommit", whyNowKey: "repaymentPath.turningPoint.overcommit", whyNowParams: { amount: sgd(Math.abs(room)) }, ifYouWaitKey: "repaymentPath.turningPoint.overcommitWait" };
  }
  if (weight != null && weight >= 50) {
    return { id: "loan-weight", whyNowKey: "repaymentPath.turningPoint.halfIncome", whyNowParams: { pct: weight }, ifYouWaitKey: "repaymentPath.turningPoint.halfIncomeWait" };
  }
  return null;
}

function monthsToYears(m) {
  if (m == null) return "—";
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return y > 0 ? `${y}y ${mo}m` : `${mo}m`;
}

function RepaymentPathInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;

  const headroom = useMemo(() => (reality ? loanHeadroom(reality) : 1000), [reality]);
  const baseExtra = Number(reality?.extra_repayment) || 0;
  const extra = Math.max(0, Math.round(Number(s.branchVars.extra_repayment ?? baseExtra)));
  const proj = s.projection?.monthsAfter != null ? s.projection : null;
  const installment = Number(reality?.monthly_installment) || 0;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("repaymentPath.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("repaymentPath.title")}</h1></header>
        <p className="wlpEmpty">{t("repaymentPath.noLoan")}</p>
      </section>
    );
  }

  const monthsNow = feas.baselineMonthsToDebtFree ?? feas.monthsToDebtFree;
  const monthsAfter = proj?.monthsAfter ?? feas.monthsToDebtFree;
  const roomAfter = proj?.roomAfter ?? feas.monthlyFreedom;
  const weightPct = proj?.debtWeightPct ?? (feas.debtWeight != null ? Math.round(feas.debtWeight * 100) : null);

  return (
    <section className="screen wlpScreen lsSceneScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("repaymentPath.title")}</h1>
        <p>{t("repaymentPath.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalLabel={t("livingScene.node.home")}
        sealMonthlyAmount={installment + extra}
        realityRows={[
          { id: "principal", label: t("repaymentPath.reality.principal"), value: sgd(feas.principal), provenance: t("repaymentPath.reality.fromLoan") },
          { id: "installment", label: t("repaymentPath.reality.installment"), value: `${sgd(installment)}/mo`, provenance: t("repaymentPath.reality.fromLoan") },
          { id: "rate", label: t("repaymentPath.reality.rate"), value: `${reality.annual_rate_percent ?? "—"}% p.a.`, provenance: t("repaymentPath.reality.fromLoan") },
          { id: "debtFree", label: t("repaymentPath.reality.debtFreeNow"), value: monthsToYears(monthsNow), provenance: t("repaymentPath.reality.amortization") },
        ]}
        realityNote={t("repaymentPath.estimateNote")}
        formatSelf={monthsToYears}
      >
        <ScenePath
          t={t}
          headroom={headroom}
          extra={extra}
          onExtra={(v) => s.setVar("extra_repayment", v)}
          monthsNow={monthsNow}
          monthsAfter={monthsAfter}
          roomAfter={roomAfter}
          weightPct={weightPct}
          installment={installment}
        />
      </SceneShell>
    </section>
  );
}

function ScenePath({ t, headroom, extra, onExtra, monthsNow, monthsAfter, roomAfter, weightPct, installment }) {
  return (
    <div className="rpPath">
      <div className="rpReadouts">
        <div className={`rpReadout ${monthsAfter != null && monthsNow != null && monthsAfter < monthsNow ? "is-better" : ""}`}>
          <span>{t("repaymentPath.debtFreeIn")}</span>
          <b>{monthsToYears(monthsAfter)}</b>
          {monthsNow != null && monthsAfter != null && monthsAfter !== monthsNow ? (
            <em>{monthsNow - monthsAfter > 0 ? t("repaymentPath.soonerBy", { n: monthsNow - monthsAfter }) : t("repaymentPath.laterBy", { n: monthsAfter - monthsNow })}</em>
          ) : null}
        </div>
        <div className={`rpReadout ${roomAfter != null && roomAfter < 0 ? "is-worse" : ""}`}>
          <span>{t("repaymentPath.monthlyFreedom")}</span>
          <b>{roomAfter != null ? `${sgd(roomAfter)}/mo` : "—"}</b>
        </div>
      </div>

      <DragTrack
        min={0}
        max={headroom}
        step={10}
        value={extra}
        onChange={onExtra}
        ariaLabel={t("repaymentPath.dragLabel")}
        poles={[t("repaymentPath.pole.breathingRoom"), t("repaymentPath.pole.debtWeight")]}
      />
      <p className="rpExtra">{t("repaymentPath.extraNow", { amount: sgd(extra), total: sgd(installment + extra) })}</p>

      {weightPct != null ? (
        <div className="rpWeightBar" aria-label={t("repaymentPath.debtWeight")}>
          <div className="rpWeightFill" style={{ width: `${Math.min(100, weightPct)}%` }} />
          <span>{t("repaymentPath.weightOfIncome", { pct: weightPct })}</span>
        </div>
      ) : null}

      <div className="rpMirror">
        <button type="button" onClick={() => onExtra(0)}>{t("repaymentPath.mirror.breathingRoom")}</button>
        <button type="button" onClick={() => onExtra(Math.round(headroom / 2 / 10) * 10)}>{t("repaymentPath.mirror.balanced")}</button>
        <button type="button" onClick={() => onExtra(headroom)}>{t("repaymentPath.mirror.clearFaster")}</button>
      </div>
    </div>
  );
}

export function RepaymentPath({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="loan" projectFn={projectRepayment} turningPointFor={loanTurningPoint}>
      <RepaymentPathInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
