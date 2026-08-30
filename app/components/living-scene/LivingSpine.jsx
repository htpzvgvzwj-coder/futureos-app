"use client";

// LivingSpine - the strip at the foot of every Studio scene.
//
// It shows ONE phase at a time - the phase that is live right now - with
// its question and the single behaviour that belongs to it. Not seven
// buttons, not seven cards. As the customer acts (drags a lever, places
// freed cashflow, acknowledges a turning point, seals), the strip moves
// itself forward.

import { SCENE_PHASES, PHASE_META, phaseIndex } from "../../../lib/living-scene/spine.js";
import { useLivingScene } from "./LivingSceneProvider.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function LivingSpine({ t }) {
  const s = useLivingScene();
  const { phase } = s;
  const idx = phaseIndex(phase);
  const meta = PHASE_META[phase] ?? PHASE_META.reality;

  return (
    <section className="lsSpine" aria-label={t("livingScene.spine.label")}>
      <ol className="lsSpineTrack" aria-hidden="true">
        {SCENE_PHASES.map((p, i) => (
          <li key={p} className={`lsSpineDot ${i < idx ? "is-done" : ""} ${i === idx ? "is-now" : ""}`} />
        ))}
      </ol>
      <p className="lsSpineStep">{t("livingScene.spine.step", { n: idx + 1 })}</p>
      <h4 className="lsSpineQ">{t(meta.questionKey)}</h4>
      <PhaseBody phase={phase} s={s} t={t} />
    </section>
  );
}

function PhaseBody({ phase, s, t }) {
  if (phase === "reality") {
    return <p className="lsSpineHint">{t("livingScene.reality.hint")}</p>;
  }

  if (phase === "possible") {
    const self = s.projection.selfOutcome;
    return (
      <div className="lsSpineBody">
        {self ? (
          <p className="lsSpineSelf">
            {t(`livingScene.self.${self.metric}`)}: <span>{fmtOutcome(self)}</span>
          </p>
        ) : null}
        <PromiseWeightLine s={s} t={t} />
        <button type="button" className="lsSpineReset" onClick={s.resetBranch}>
          {t("livingScene.reset")}
        </button>
      </div>
    );
  }

  if (phase === "allocation") {
    return (
      <div className="lsSpineBody">
        <p className="lsSpineHint">
          {s.freedCashflow > 0
            ? t("livingScene.allocation.freed", { amount: sgd(s.freedCashflow) })
            : t("livingScene.allocation.pressure", { amount: sgd(s.addedPressure) })}
        </p>
        <p className="lsSpineHint lsMuted">{t("livingScene.allocation.spineNote")}</p>
      </div>
    );
  }

  if (phase === "turning_point") {
    const tp = s.turningPoint;
    const whyNow = tp?.whyNowKey ? t(tp.whyNowKey, tp.whyNowParams) : tp?.whyNow;
    const ifWait = tp?.ifYouWaitKey ? t(tp.ifYouWaitKey, tp.ifYouWaitParams) : tp?.ifYouWait;
    return (
      <div className="lsSpineBody">
        {tp ? (
          <>
            <p className="lsSpineSelf">{whyNow ?? t("livingScene.turningPoint.generic")}</p>
            {ifWait ? <p className="lsSpineHint">{t("livingScene.turningPoint.ifYouWait", { text: ifWait })}</p> : null}
          </>
        ) : null}
        <button type="button" className="lsSpinePrimary" onClick={s.acknowledgeTurningPoint}>
          {t("livingScene.turningPoint.acknowledge")}
        </button>
      </div>
    );
  }

  if (phase === "committed") {
    return <p className="lsSpineHint">{t("livingScene.committed.hint")}</p>;
  }

  if (phase === "guardian") {
    return (
      <div className="lsSpineBody">
        <p className="lsSpineHint">{t("livingScene.guardian.watching")}</p>
        <button type="button" className="lsSpineReset" onClick={s.standDownGuardian}>
          {t("livingScene.guardian.standDown")}
        </button>
      </div>
    );
  }

  // memory
  return <p className="lsSpineHint">{t("livingScene.memory.hint")}</p>;
}

function PromiseWeightLine({ s, t }) {
  // Promise Weight for this scene: does the current branch make any month
  // tighter across the customer's other commitments? Uses the real
  // available cashflow from the field context.
  const avail = Number(s.context?.availableMonthlyCashflow);
  const added = s.addedPressure;
  if (!Number.isFinite(avail) || avail <= 0) return null;
  if (added <= 0) return <p className="lsSpineHint lsMuted">{t("livingScene.promiseWeight.calm")}</p>;
  const ratio = added / avail;
  const key = ratio >= 1 ? "livingScene.promiseWeight.needsDecision" : ratio >= 0.5 ? "livingScene.promiseWeight.tightening" : "livingScene.promiseWeight.calm";
  return <p className="lsSpineHint lsMuted">{t(key, { amount: `SGD ${Math.round(added)}`, of: `SGD ${Math.round(avail)}` })}</p>;
}

function fmtOutcome(self) {
  if (self == null || self.after == null) return "—";
  const unit = self.unit || "";
  if (unit === "months") return `${self.after} mo`;
  if (unit === "years") return `${self.after} yr`;
  if (unit === "sgd" || unit === "sgd_per_month") return sgd(self.after) + (unit === "sgd_per_month" ? "/mo" : "");
  return String(self.after);
}
