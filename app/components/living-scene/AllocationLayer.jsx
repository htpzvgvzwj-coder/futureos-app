"use client";

// AllocationLayer - "Who carries the freed or added resource, and where
// does it go?"
//
// When a branch FREES monthly cashflow, that money is never routed
// automatically. The customer places it: Keep Flexible / Accelerate a goal
// / Rebuild Safety / Split. When a branch ADDS monthly pressure, the same
// control asks where the extra comes from. Over-allocation is blocked; an
// under-allocated remainder stays "available", not quietly absorbed.

import { useLivingScene } from "./LivingSceneProvider.jsx";
import { allToLeg, allocationSum, normalizeAllocation } from "../../../lib/living-plan/allocation.js";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

const LEGS = [
  { leg: "flexible", key: "flexibleMonthly", labelKey: "livingScene.allocation.keepFlexible" },
  { leg: "goal", key: "goalMonthly", labelKey: "livingScene.allocation.accelerate" },
  { leg: "emergency", key: "emergencyMonthly", labelKey: "livingScene.allocation.rebuildSafety" },
];

export function AllocationLayer({ t, goalLabel }) {
  const s = useLivingScene();
  const freed = s.freedCashflow;
  const pressure = s.addedPressure;
  if (freed <= 0 && pressure <= 0) return null;

  const alloc = s.allocation;
  const sum = allocationSum(alloc);
  const remaining = Math.max(0, freed - sum);
  const over = s.allocationOverspent;

  const setLeg = (key, value) => {
    const next = normalizeAllocation({ ...alloc, [key]: Math.max(0, Math.round(value)) });
    s.setAllocation(next);
  };

  if (pressure > 0 && freed <= 0) {
    // Added pressure: acknowledge where it is sourced from. No auto-move.
    return (
      <section className="lsLayer lsAllocation" aria-label={t("livingScene.allocation.title")}>
        <h3>{t("livingScene.allocation.title")}</h3>
        <p className="lsAllocPressure">{t("livingScene.allocation.pressure", { amount: sgd(pressure) })}</p>
        <div className="lsAllocChoices">
          <button type="button" className={s.allocationTouched ? "is-set" : ""} onClick={() => s.setAllocation({ flexibleMonthly: pressure })}>
            {t("livingScene.allocation.fromFlexible")}
          </button>
          <button type="button" onClick={() => s.setAllocation({ goalMonthly: pressure })}>
            {t("livingScene.allocation.slowAnother", { goal: goalLabel ?? t("livingScene.allocation.anotherGoal") })}
          </button>
        </div>
        <p className="lsProvenance">{t("livingScene.allocation.noAutoMove")}</p>
      </section>
    );
  }

  return (
    <section className="lsLayer lsAllocation" aria-label={t("livingScene.allocation.title")}>
      <h3>{t("livingScene.allocation.title")}</h3>
      <p className="lsAllocFreed">{t("livingScene.allocation.freed", { amount: sgd(freed) })}</p>

      <div className="lsAllocChoices">
        <button type="button" onClick={() => s.setAllocation(allToLeg("flexible", freed))}>
          {t("livingScene.allocation.keepFlexible")}
        </button>
        <button type="button" onClick={() => s.setAllocation(allToLeg("goal", freed))}>
          {t("livingScene.allocation.accelerate", { goal: goalLabel ?? t("livingScene.allocation.anotherGoal") })}
        </button>
        <button type="button" onClick={() => s.setAllocation(allToLeg("emergency", freed))}>
          {t("livingScene.allocation.rebuildSafety")}
        </button>
      </div>

      <div className="lsAllocSplit">
        <p className="lsAllocSplitHead">{t("livingScene.allocation.split")}</p>
        {LEGS.map(({ leg, key, labelKey }) => (
          <label key={leg} className="lsAllocSlider">
            <span>{t(labelKey, { goal: goalLabel ?? t("livingScene.allocation.anotherGoal") })}</span>
            <input
              type="range"
              min="0"
              max={Math.max(freed, 1)}
              step="10"
              value={Math.min(alloc[key], freed)}
              onChange={(e) => setLeg(key, Number(e.target.value))}
              aria-label={t(labelKey, { goal: goalLabel ?? t("livingScene.allocation.anotherGoal") })}
            />
            <b>{sgd(alloc[key])}</b>
          </label>
        ))}
      </div>

      <p className={over ? "lsAllocOver" : "lsAllocRemaining"}>
        {over
          ? t("livingScene.allocation.overspent", { amount: sgd(sum - freed) })
          : t("livingScene.allocation.remaining", { amount: sgd(remaining) })}
      </p>
      <p className="lsProvenance">{t("livingScene.allocation.noAutoMove")}</p>
    </section>
  );
}
