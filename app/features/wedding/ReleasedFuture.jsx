"use client";

// Released Future - when a wedding branch frees monthly cashflow, this is
// where the customer decides what that new choice is for. Nothing is moved
// automatically. Keep Flexible / Add to Home / Rebuild Emergency / Split.

import { useEffect, useMemo, useState } from "react";
import { validateAllocation, allToLeg } from "../../../lib/living-plan/allocation.js";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function ReleasedFuture({ selectedBranch, t, call, reload, busy }) {
  const proj = selectedBranch?.projectedImpacts ?? null;
  const freed = proj?.mode === "freed" ? proj.freedCashflow || 0 : 0;

  const existing = selectedBranch?.allocation ?? selectedBranch?.data?.allocation ?? null;
  const [alloc, setAlloc] = useState(() => existing ?? { goalMonthly: 0, emergencyMonthly: 0, flexibleMonthly: 0 });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setAlloc(existing ?? { goalMonthly: 0, emergencyMonthly: 0, flexibleMonthly: 0 });
    setMsg("");
  }, [selectedBranch?.id, existing]);

  const check = useMemo(() => validateAllocation({ freedCashflow: freed, allocation: alloc }), [freed, alloc]);

  if (!selectedBranch) {
    return (
      <section className="wlpView wlpReleased" aria-labelledby="releasedTitle">
        <h3 id="releasedTitle">{t("weddingLivingPlan.released.title")}</h3>
        <p className="wlpMuted">{t("weddingLivingPlan.released.selectFirst")}</p>
      </section>
    );
  }

  if (proj?.mode === "pressure") {
    return (
      <section className="wlpView wlpReleased" aria-labelledby="releasedTitle">
        <h3 id="releasedTitle">{t("weddingLivingPlan.released.title")}</h3>
        <p className="wlpWarn">
          {t("weddingLivingPlan.released.pressure", { amount: sgd(proj.pressure?.extraMonthlyNeeded ?? 0) })}
        </p>
      </section>
    );
  }

  if (freed <= 0) {
    return (
      <section className="wlpView wlpReleased" aria-labelledby="releasedTitle">
        <h3 id="releasedTitle">{t("weddingLivingPlan.released.title")}</h3>
        <p className="wlpMuted">{t("weddingLivingPlan.released.nothingFreed")}</p>
      </section>
    );
  }

  const setLeg = (leg, value) => {
    const v = Math.max(0, Number(value) || 0);
    setAlloc((a) => ({ ...a, [leg]: v }));
    setMsg("");
  };

  const oneTap = (leg) => setAlloc(allToLeg(leg, freed));

  const apply = async () => {
    setMsg("");
    const r = await call(`/api/future-field/branch?action=allocate&domain=wedding`, {
      branchId: selectedBranch.id,
      goalId: "home",
      allocation: check.allocation,
    });
    if (r.ok) {
      setMsg(t("weddingLivingPlan.released.applied", { unallocated: sgd(r.data.unallocated ?? 0) }));
      await reload();
    } else {
      setMsg(t(`futureField.err.${r.data.error}`) === `futureField.err.${r.data.error}` ? t("weddingLivingPlan.released.applyError") : t(`futureField.err.${r.data.error}`));
    }
  };

  const applied = proj.allocatedImpact ?? null;
  const avail = proj.availableImpact ?? null;

  return (
    <section className="wlpView wlpReleased" aria-labelledby="releasedTitle">
      <h3 id="releasedTitle">{t("weddingLivingPlan.released.title")}</h3>
      <p className="wlpReleasedLede">
        {t("weddingLivingPlan.released.lede", { amount: sgd(freed) })}
      </p>
      <p className="wlpMuted">{t("weddingLivingPlan.released.notCommitted")}</p>

      <div className="wlpReleasedTaps">
        <button type="button" className="secondaryButton" onClick={() => oneTap("flexible")}>{t("weddingLivingPlan.allocation.target.flexible")}</button>
        <button type="button" className="secondaryButton" onClick={() => oneTap("goal")}>{t("weddingLivingPlan.allocation.target.home")}</button>
        <button type="button" className="secondaryButton" onClick={() => oneTap("emergency")}>{t("weddingLivingPlan.allocation.target.emergency")}</button>
      </div>

      <div className="wlpReleasedSplit">
        <label>
          {t("weddingLivingPlan.allocation.target.home")}
          <input type="number" min="0" max={freed} value={alloc.goalMonthly} onChange={(e) => setLeg("goalMonthly", e.target.value)} />
        </label>
        <label>
          {t("weddingLivingPlan.allocation.target.emergency")}
          <input type="number" min="0" max={freed} value={alloc.emergencyMonthly} onChange={(e) => setLeg("emergencyMonthly", e.target.value)} />
        </label>
        <label>
          {t("weddingLivingPlan.allocation.target.flexible")}
          <input type="number" min="0" max={freed} value={alloc.flexibleMonthly} onChange={(e) => setLeg("flexibleMonthly", e.target.value)} />
        </label>
      </div>

      <p className={check.ok ? "wlpMuted" : "wlpWarn"}>
        {check.ok
          ? t("weddingLivingPlan.released.unallocated", { amount: sgd(check.unallocated) })
          : t("weddingLivingPlan.released.overAllocated", { amount: sgd(freed) })}
      </p>

      {/* what the freed money COULD do, before allocation */}
      {avail ? (
        <ul className="wlpReleasedAvailable">
          {avail.maxHomeMonthsEarlier ? (
            <li>{t("weddingLivingPlan.released.availHome", { months: avail.maxHomeMonthsEarlier })}</li>
          ) : null}
          {avail.maxEmergencyBufferAfter ? (
            <li>{t("weddingLivingPlan.released.availEmergency", { months: avail.maxEmergencyBufferAfter })}</li>
          ) : null}
        </ul>
      ) : null}

      <button type="button" className="primaryButton" disabled={busy || !check.ok} onClick={apply}>
        {t("weddingLivingPlan.released.apply")}
      </button>

      {/* what the CURRENT allocation actually does */}
      {applied ? (
        <div className="wlpReleasedResult" role="status">
          <strong>{t("weddingLivingPlan.released.resultTitle")}</strong>
          <ul>
            {applied.home && applied.home.monthsDelta ? (
              <li>
                {applied.home.monthsDelta < 0
                  ? t("weddingLivingPlan.released.homeEarlier", { months: Math.abs(applied.home.monthsDelta), month: applied.home.readyMonthAfter })
                  : t("weddingLivingPlan.released.homeLater", { months: applied.home.monthsDelta })}
              </li>
            ) : null}
            {applied.emergency && applied.emergency.direction === "up" ? (
              <li>{t("weddingLivingPlan.released.emergencyUp", { before: applied.emergency.bufferBefore, after: applied.emergency.bufferAfter })}</li>
            ) : null}
            {applied.flexible && applied.flexible.added > 0 ? (
              <li>{t("weddingLivingPlan.released.flexibleUp", { amount: sgd(applied.flexible.added) })}</li>
            ) : null}
          </ul>
          <p className="wlpMuted">{t("weddingLivingPlan.released.stillPossible")}</p>
        </div>
      ) : null}

      {msg ? <p className="wlpMirrorMsg" role="status">{msg}</p> : null}
    </section>
  );
}
