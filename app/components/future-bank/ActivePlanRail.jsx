"use client";

// "Plans in motion" (Today) / "Your plans are moving" (Explore). Only real
// active drafts + sealed commitments - never the nine Studios, never a
// directory. Each row: Preview / Committed, monthly amount, its current
// trajectory and most recent real impact, and Continue / Review impact /
// Adjust.
//
// The aggregate money row is taken straight from Life Thread's
// `monthlyResourceTotals` (via money-moments `monthlyResourceSummary`) so
// one resource is never counted once per affected goal.

import css from "./future-bank.module.css";
import { useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";
import { money, monthly, relTime, afterLabel, directionClass } from "./format.js";
import { PlanMovement } from "./PlanMovement.jsx";

const STATE_LABEL = { committed: "Committed", preview: "Preview", draft: "Draft" };

export function ActivePlanRail({ limit = 3, dense = true, onRoute, showTotals = true }) {
  const { tx } = useTx();
  const { planMovement, resourceSummary, status } = useFutureBankData();

  if (status === "loading" && !planMovement.length) return <p className={css.empty}>{tx("Loading your plans…")}</p>;

  const rows = [...(planMovement ?? [])]
    .sort((a, b) => String(b.lastUpdatedAt ?? "").localeCompare(String(a.lastUpdatedAt ?? "")))
    .slice(0, limit);

  if (rows.length === 0) {
    return <p className={css.empty}>{tx("No active plans yet. Build one from “What needs you next”.")}</p>;
  }

  return (
    <div className={css.section}>
      {rows.map((p) => {
        const trajectory = (p.affected ?? []).find((a) => a.direction && a.direction !== "flat");
        const tl = trajectory ? afterLabel(trajectory) : null;
        return (
          <div key={`${p.domain}:${p.planId ?? p.branchId ?? "x"}`} className={css.planCard}>
            <div className={css.planTop}>
              <span className={css.planName}>{tx(p.domain)}</span>
              <span className={`${css.stateTag} ${css[p.state] || ""}`}>{tx(STATE_LABEL[p.state] ?? p.state)}</span>
            </div>
            <span className={css.planMonthly}>
              {p.state === "committed"
                ? `${monthly(p.monthlyClaimed)} ${tx("committed")}`
                : p.monthlyClaimed > 0
                  ? `${monthly(p.monthlyClaimed)} ${tx("claimed (preview)")}`
                  : p.monthlyReleased > 0
                    ? `${monthly(p.monthlyReleased)} ${tx("released (preview)")}`
                    : tx("No monthly claim yet")}
            </span>
            {trajectory ? (
              <span className={css.empty}>
                {tx("Trajectory")}: {String(trajectory.domain).replace(/_/g, " ")} {String(trajectory.metric).replace(/_/g, " ")}{" "}
                <span className={css[directionClass(trajectory)] || undefined}>
                  {trajectory.before != null ? `${trajectory.before} → ` : ""}
                  {tl.value}
                </span>
                {tl.tag ? ` · ${tl.tag}` : ""}
              </span>
            ) : (
              <span className={css.empty}>{tx("Trajectory: no other plan materially affected yet.")}</span>
            )}
            {p.lastChange ? (
              <span className={css.empty}>
                {tx("Last change")}: {p.lastChange.headline} · {relTime(p.lastChange.occurredAt)}
              </span>
            ) : null}
            {!dense && <PlanMovement plan={p} />}
            <div className={css.planActions}>
              <button type="button" className={`${css.act} ${css.primary}`} onClick={() => onRoute?.(`studio:${p.domain}`, p)}>
                {p.state === "committed" ? tx("Review plan") : tx("Continue")}
              </button>
              <button type="button" className={css.act} onClick={() => onRoute?.("explore:plans", p)}>
                {tx("Review impact")}
              </button>
              <button type="button" className={css.act} onClick={() => onRoute?.(`studio:${p.domain}`, p)}>
                {tx("Adjust")}
              </button>
            </div>
          </div>
        );
      })}

      {showTotals && resourceSummary && (
        <div className={css.totals}>
          <div className={css.totalCell}>
            <small>{tx("Committed / month")}</small>
            <b>{money(resourceSummary.committedMonthly)}</b>
          </div>
          <div className={css.totalCell}>
            <small>{tx("Possible added pressure")}</small>
            <b>{money(resourceSummary.possibleAddedPressureMonthly)}</b>
          </div>
          <div className={css.totalCell}>
            <small>{tx("Released, not allocated")}</small>
            <b>{money(resourceSummary.releasedUnallocatedMonthly)}</b>
          </div>
          <div className={css.totalCell}>
            <small>{tx("Remaining monthly room")}</small>
            <b>{money(resourceSummary.remainingMonthlyRoom)}</b>
          </div>
        </div>
      )}
    </div>
  );
}
