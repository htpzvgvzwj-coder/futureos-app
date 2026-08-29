"use client";

// Future Handoff - when a commitment was revoked (or completes), the
// monthly it used is released. The customer places it: Home / Emergency /
// Flexible / Split. Nothing moves to another goal until confirmed here.
// Rendered on the Guardian screen.

import { useCallback, useEffect, useState } from "react";
import { validateAllocation, allToLeg } from "../../lib/living-plan/allocation.js";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

function HandoffRow({ h, t, onConfirmed }) {
  const [alloc, setAlloc] = useState({ goalMonthly: 0, emergencyMonthly: 0, flexibleMonthly: 0 });
  const [msg, setMsg] = useState("");
  const check = validateAllocation({ freedCashflow: h.releasedMonthly, allocation: alloc });

  const confirm = async () => {
    setMsg("");
    const res = await fetch("/api/living-plan/handoffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromCommitmentId: h.fromCommitmentId, allocation: check.allocation }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(t("futureHandoff.confirmed", { unallocated: sgd(data.unallocated ?? 0) }));
      onConfirmed?.();
    } else {
      setMsg(t("futureHandoff.error"));
    }
  };

  return (
    <li className="fhRow">
      <p className="fhLede">
        {t("futureHandoff.released", { domain: t(`memoryLens.goal.${h.fromDomain}`) === `memoryLens.goal.${h.fromDomain}` ? h.fromDomain : t(`memoryLens.goal.${h.fromDomain}`), amount: sgd(h.releasedMonthly), from: h.availableFromMonth })}
      </p>
      <div className="fhTaps">
        <button type="button" className="secondaryButton" onClick={() => setAlloc(allToLeg("flexible", h.releasedMonthly))}>{t("weddingLivingPlan.allocation.target.flexible")}</button>
        <button type="button" className="secondaryButton" onClick={() => setAlloc(allToLeg("goal", h.releasedMonthly))}>{t("weddingLivingPlan.allocation.target.home")}</button>
        <button type="button" className="secondaryButton" onClick={() => setAlloc(allToLeg("emergency", h.releasedMonthly))}>{t("weddingLivingPlan.allocation.target.emergency")}</button>
      </div>
      <div className="fhSplit">
        <label>{t("weddingLivingPlan.allocation.target.home")}<input type="number" min="0" max={h.releasedMonthly} value={alloc.goalMonthly} onChange={(e) => setAlloc((a) => ({ ...a, goalMonthly: Math.max(0, Number(e.target.value) || 0) }))} /></label>
        <label>{t("weddingLivingPlan.allocation.target.emergency")}<input type="number" min="0" max={h.releasedMonthly} value={alloc.emergencyMonthly} onChange={(e) => setAlloc((a) => ({ ...a, emergencyMonthly: Math.max(0, Number(e.target.value) || 0) }))} /></label>
        <label>{t("weddingLivingPlan.allocation.target.flexible")}<input type="number" min="0" max={h.releasedMonthly} value={alloc.flexibleMonthly} onChange={(e) => setAlloc((a) => ({ ...a, flexibleMonthly: Math.max(0, Number(e.target.value) || 0) }))} /></label>
      </div>
      <p className={check.ok ? "fhMuted" : "fhWarn"}>
        {check.ok ? t("futureHandoff.unallocated", { amount: sgd(check.unallocated) }) : t("futureHandoff.overAllocated")}
      </p>
      <button type="button" className="primaryButton" disabled={!check.ok} onClick={confirm}>{t("futureHandoff.confirm")}</button>
      {msg ? <p className="fhMsg" role="status">{msg}</p> : null}
    </li>
  );
}

export function FutureHandoffPanel({ t }) {
  const [candidates, setCandidates] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/living-plan/handoffs");
      const data = await res.json();
      setCandidates(res.ok ? data.candidates ?? [] : []);
    } catch {
      setCandidates([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!candidates || candidates.length === 0) return null;

  return (
    <section className="fhPanel" aria-labelledby="fhTitle">
      <h3 id="fhTitle">{t("futureHandoff.title")}</h3>
      <p className="fhMuted">{t("futureHandoff.help")}</p>
      <ul className="fhList">
        {candidates.map((h) => (
          <HandoffRow key={h.fromCommitmentId} h={h} t={t} onConfirmed={load} />
        ))}
      </ul>
    </section>
  );
}
