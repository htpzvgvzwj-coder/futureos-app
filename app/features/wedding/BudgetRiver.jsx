"use client";

// Budget River - the wedding budget as a flow over time, not a category
// table. Current savings + monthly contributions on one side; deposit,
// progress and balance payments on the other; the shortfall and the month
// of peak pressure in between. All figures come from the real payment
// schedule + finance in field.realityPath.feasibility.

import { useMemo, useState } from "react";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
function monthOf(iso) {
  return String(iso || "").slice(0, 7);
}

export function BudgetRiver({ field, t, peel, busy }) {
  const f = field?.realityPath?.feasibility ?? {};
  const data = field?.realityPath?.data ?? {};
  const schedule = f.paymentSchedule ?? [];
  const [raiseTo, setRaiseTo] = useState("");

  const currentSavings = Number(data.current_savings) || 0;
  const userMonthly = f.monthlyContribution ?? (Number(data.monthly_contribution) || 0);
  const partnerMonthly = f.partnerMonthly ?? (Number(data.partner_contribution) || 0);

  // Month of peak pressure = the milestone with the largest gap between its
  // amount and what will have been saved by its due date.
  const pressure = useMemo(() => {
    let saved = currentSavings;
    let worst = null;
    const now = new Date();
    for (const m of schedule) {
      const due = new Date(m.dueDate);
      const months = Math.max(0, (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth()));
      saved += (userMonthly + partnerMonthly) * months - 0;
      const gap = Math.round(m.amount - saved);
      if (worst == null || gap > worst.gap) worst = { id: m.id, month: monthOf(m.dueDate), gap };
      saved -= m.amount;
      now.setMonth(now.getMonth() + months);
    }
    return worst;
  }, [schedule, currentSavings, userMonthly, partnerMonthly]);

  const gap = f.budgetGap ?? 0;

  return (
    <section className="wlpView wlpBudgetRiver" aria-labelledby="budgetRiverTitle">
      <h3 id="budgetRiverTitle">{t("weddingLivingPlan.budgetRiver.title")}</h3>
      <p className="wlpMuted">{t("weddingLivingPlan.budgetRiver.help")}</p>

      <dl className="wlpRiverInflow">
        <div><dt>{t("weddingLivingPlan.budgetRiver.currentSavings")}</dt><dd>{sgd(currentSavings)}</dd></div>
        <div><dt>{t("weddingLivingPlan.budgetRiver.yourMonthly")}</dt><dd>{sgd(userMonthly)}/mo</dd></div>
        <div><dt>{t("weddingLivingPlan.budgetRiver.partnerMonthly")}</dt><dd>{sgd(partnerMonthly)}/mo</dd></div>
        <div><dt>{t("weddingLivingPlan.budgetRiver.requiredMonthly")}</dt><dd>{sgd(f.userRequiredMonthly ?? 0)}/mo</dd></div>
      </dl>

      <ol className="wlpRiverFlow">
        {schedule.map((m) => (
          <li key={m.id}>
            <span className="wlpRiverWhen">{monthOf(m.dueDate)}</span>
            <span className="wlpRiverWhat">{t(`weddingLivingPlan.budgetRiver.milestone.${m.id}`) === `weddingLivingPlan.budgetRiver.milestone.${m.id}` ? m.label : t(`weddingLivingPlan.budgetRiver.milestone.${m.id}`)}</span>
            <span className="wlpRiverAmt">{sgd(m.amount)}</span>
          </li>
        ))}
      </ol>

      {pressure ? (
        <p className="wlpRiverPeak">
          {pressure.gap > 0
            ? t("weddingLivingPlan.budgetRiver.peakShort", { month: pressure.month, amount: sgd(pressure.gap) })
            : t("weddingLivingPlan.budgetRiver.peakOk", { month: pressure.month })}
        </p>
      ) : null}

      {gap > 0 ? (
        <div className="wlpRiverGap wlpWarn">
          <p>{t("weddingLivingPlan.budgetRiver.belowCore", { amount: sgd(gap), core: sgd(f.computedCoreTotal) })}</p>
          <ul>
            {(f.unresolvedItems ?? []).slice(0, 3).map((u) => (
              <li key={u.category}>{u.label}: {sgd(u.subtotal)}</li>
            ))}
          </ul>
          <label>
            {t("weddingLivingPlan.budgetRiver.raiseTo")}
            <input type="number" value={raiseTo} onChange={(e) => setRaiseTo(e.target.value)} min={f.computedCoreTotal || 0} />
          </label>
          <button
            type="button"
            className="secondaryButton"
            disabled={busy || !(Number(raiseTo) >= (f.computedCoreTotal || 0))}
            onClick={() => peel({ total_budget: Number(raiseTo) }, t("weddingLivingPlan.budgetRiver.raiseBranchLabel"))}
          >
            {t("weddingLivingPlan.budgetRiver.raiseCta")}
          </button>
        </div>
      ) : (
        <p className="wlpMuted">{t("weddingLivingPlan.budgetRiver.covered")}</p>
      )}

      <p className="wlpProvenance">{t("weddingLivingPlan.estimateNote")}</p>
    </section>
  );
}
