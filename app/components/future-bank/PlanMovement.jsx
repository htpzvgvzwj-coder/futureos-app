"use client";

// One plan's movement, in the Money Current visual language: the plan's own
// monthly claim/release, then every materially affected plan/goal with its
// before -> after and an honest Preview / Committed tag. Unknown values say
// "Needs more information"; unlike units are never combined (each row keeps
// its own unit).

import css from "./future-bank.module.css";
import { monthly, afterLabel, directionClass, humanMetric, isMaterial } from "./format.js";

function unitLabel(u) {
  if (!u || u === "qualitative") return "";
  return u.replace(/_/g, " ").replace("sgd per month", "/mo").replace("months", "mo");
}

export function PlanMovement({ plan, dense = false }) {
  const affected = (plan.affected ?? []).filter(isMaterial);
  const claim = Number(plan.monthlyClaimed) || 0;
  const release = Number(plan.monthlyReleased) || 0;

  return (
    <div className={css.movement}>
      {claim > 0 && (
        <div className={css.moveRow}>
          <span className="k">This plan claims</span>
          <span className={`v down`}>{monthly(claim)}</span>
        </div>
      )}
      {release > 0 && (
        <div className={css.moveRow}>
          <span className="k">This plan releases</span>
          <span className={`v up`}>{monthly(release)}</span>
        </div>
      )}
      {affected.length === 0 ? (
        <div className={css.moveRow}>
          <span className="k">Affected plans</span>
          <span className="v unknown">None yet</span>
        </div>
      ) : (
        affected.slice(0, dense ? 2 : 6).map((a, i) => {
          const after = afterLabel(a);
          return (
            <div key={i} className={css.moveRow}>
              <span className="k">
                {String(a.domain).replace(/_/g, " ")} · {humanMetric(a.metric)}
              </span>
              <span className={`v ${after.value === "Needs more information" ? "unknown" : directionClass(a)}`}>
                {a.before != null ? `${a.before} → ` : ""}
                {after.value}
                {unitLabel(a.unit) ? ` ${unitLabel(a.unit)}` : ""}
                {after.tag ? (
                  <span className={after.tagKind === "committed" ? css.committedNote : css.previewNote}> · {after.tag}</span>
                ) : null}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
