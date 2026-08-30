"use client";

// MomentOutlet - renders EXACTLY ONE outlet for the runtime's current
// phase, or nothing. This is the whole of Part 1: the customer sees one
// current moment, never a stack of reached panels.
//
//   reality       -> nothing (RealitySummary + native scene only)
//   possible      -> one inline causal receipt (+ a Review button when the
//                    commitment gates are all clear)
//   allocation    -> the Allocation Moment sheet
//   turning_point -> the Turning Point Moment sheet
//   committed     -> the sealed receipt only
//   guardian      -> a compact "Guardian is watching" state
//   memory        -> nothing here (opened only via the Memory drawer)

import { useState } from "react";
import { useLivingScene } from "./LivingSceneProvider.jsx";
import { momentForPhase } from "../../../lib/living-scene/spine.js";
import { allToLeg, allocationSum, normalizeAllocation } from "../../../lib/living-plan/allocation.js";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function MomentOutlet({ t, sealMonthlyAmount = 0, goalOptions = [], formatSelf }) {
  const s = useLivingScene();
  const outlet = momentForPhase(s.phase);

  if (outlet === "causal_receipt") return <CausalReceipt t={t} formatSelf={formatSelf} sealMonthlyAmount={sealMonthlyAmount} />;
  if (outlet === "allocation_moment") return <AllocationMoment t={t} goalOptions={goalOptions} />;
  if (outlet === "turning_point_moment") return <TurningPointMoment t={t} />;
  if (outlet === "sealed_receipt") return <SealedReceipt t={t} sealMonthlyAmount={sealMonthlyAmount} />;
  if (outlet === "guardian_watch") return <GuardianWatch t={t} />;
  return null;
}

// ---- possible -----------------------------------------------------------
function CausalReceipt({ t, formatSelf, sealMonthlyAmount }) {
  const s = useLivingScene();
  const [sheet, setSheet] = useState(false);
  const self = s.projection.selfOutcome;
  const topNode = (s.projection.nodes ?? [])[0] ?? null;

  return (
    <section className="lsOutlet lsCausal" aria-label={t("livingScene.possible.title")}>
      {self ? (
        <p className="lsCausalLine">
          <span>{t(`livingScene.self.${self.metric}`)}</span>
          <span className="lsCausalMove">
            <span className="lsWas">{formatSelf ? formatSelf(self.before) : self.before}</span>
            <span className={`lsDir lsDir-${self.dir || "flat"}`}>{self.dir === "down" ? "↓" : self.dir === "up" ? "↑" : "→"}</span>
            <b>{formatSelf ? formatSelf(self.after) : self.after}</b>
          </span>
        </p>
      ) : null}
      {topNode ? (
        <p className="lsCausalNode">
          {t(`livingScene.node.${topNode.id}`)} · {topNode.note ?? t(`livingScene.node.dir.${topNode.dir || "flat"}`)}
        </p>
      ) : null}
      <p className="lsProvenance">{s.serverProjection ? t("livingScene.possible.serverConfirmed") : t("livingScene.possible.projectedNote")}</p>

      <div className="lsCausalActions">
        <button type="button" className="lsGhostBtn" onClick={s.resetBranch}>
          {t("livingScene.reset")}
        </button>
        {s.canReviewCommitment ? (
          <button type="button" className="lsPrimaryBtn" onClick={() => setSheet(true)}>
            {t("livingScene.committed.review", { amount: sgd(sealMonthlyAmount) })}
          </button>
        ) : null}
      </div>

      {sheet && s.canReviewCommitment ? <CommitmentSheet t={t} amount={sealMonthlyAmount} onClose={() => setSheet(false)} /> : null}
    </section>
  );
}

function CommitmentSheet({ t, amount, onClose }) {
  const s = useLivingScene();
  const [stage, setStage] = useState("idle"); // idle | preview | done | error
  const [preview, setPreview] = useState(null);

  const openPreview = async () => {
    setStage("loading");
    const r = await s.seal(amount);
    if (r.ok) {
      setPreview(r.preview);
      setStage("preview");
    } else {
      setPreview(r.preview ?? null);
      setStage("error");
    }
  };
  const confirm = async () => {
    setStage("loading");
    const r = await s.confirmSeal(amount);
    if (r.ok) {
      setStage("done");
      onClose();
    } else {
      setStage("error");
    }
  };

  return (
    <div className="lsSheet" role="dialog" aria-modal="true" aria-label={t("livingScene.committed.title")}>
      <div className="lsSheetInner">
        <h4>{t("livingScene.committed.title")}</h4>
        {stage === "idle" || stage === "loading" ? (
          <>
            <p className="lsSheetLine">{t("livingScene.committed.monthly")}: <b>{sgd(amount)}/mo</b></p>
            <button type="button" className="lsPrimaryBtn" disabled={stage === "loading"} onClick={openPreview}>
              {t("livingScene.committed.seePreview")}
            </button>
          </>
        ) : null}
        {stage === "preview" && preview ? (
          <>
            <dl className="lsSheetDl">
              <div><dt>{t("livingScene.committed.monthly")}</dt><dd>{sgd(amount)}/mo</dd></div>
              {preview.effectiveMonth ? <div><dt>{t("livingScene.committed.effective")}</dt><dd>{preview.effectiveMonth}</dd></div> : null}
              {preview.readyMonth ? <div><dt>{t("livingScene.committed.ready")}</dt><dd>{preview.readyMonth}</dd></div> : null}
            </dl>
            <ul className="lsSheetTerms">
              <li>{t("livingScene.committed.guardianCant")}</li>
              <li>{t("livingScene.committed.shadowOnly")}</li>
              <li>{t("livingScene.committed.autopause")}</li>
              <li>{t("livingScene.committed.revocable")}</li>
            </ul>
            <div className="lsSheetActions">
              <button type="button" className="lsPrimaryBtn" disabled={stage === "loading"} onClick={confirm}>
                {t("livingScene.committed.confirm")}
              </button>
              <button type="button" className="lsGhostBtn" onClick={onClose}>{t("livingScene.committed.notYet")}</button>
            </div>
          </>
        ) : null}
        {stage === "error" ? (
          <>
            <p className="lsSealError">
              {s.sealState.error === "budget_below_core" || preview?.sealable === false
                ? t("livingScene.committed.notSealable")
                : t("livingScene.committed.sealError")}
            </p>
            <button type="button" className="lsGhostBtn" onClick={onClose}>{t("livingScene.committed.notYet")}</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---- allocation -------------------------------------------------------
const LEGS = [
  { leg: "flexible", key: "flexibleMonthly", labelKey: "livingScene.allocation.keepFlexible" },
  { leg: "goal", key: "goalMonthly", labelKey: "livingScene.allocation.accelerate" },
  { leg: "emergency", key: "emergencyMonthly", labelKey: "livingScene.allocation.rebuildSafety" },
];

function AllocationMoment({ t, goalOptions }) {
  const s = useLivingScene();
  const freed = s.freedCashflow;
  const pressure = s.addedPressure;
  const alloc = s.allocation;
  const sum = allocationSum(alloc);
  const remaining = Math.max(0, freed - sum);
  const targets = goalOptions.length ? goalOptions : [{ id: "home" }, { id: "emergency" }, { id: "retirement" }];

  if (pressure > 0 && freed <= 0) {
    return (
      <section className="lsOutlet lsAllocMoment" aria-label={t("livingScene.allocation.title")}>
        <h4>{t("livingScene.allocation.title")}</h4>
        <p className="lsAllocPressure">{t("livingScene.allocation.pressure", { amount: sgd(pressure) })}</p>
        <div className="lsAllocChoices">
          <button type="button" onClick={() => s.setAllocation({ flexibleMonthly: pressure }, null)}>{t("livingScene.allocation.fromFlexible")}</button>
        </div>
        <p className="lsProvenance">{t("livingScene.allocation.noAutoMove")}</p>
      </section>
    );
  }

  const setLeg = (key, value) => s.setAllocation(normalizeAllocation({ ...alloc, [key]: Math.max(0, Math.round(value)) }), s.allocationTarget);

  return (
    <section className="lsOutlet lsAllocMoment" aria-label={t("livingScene.allocation.title")}>
      <h4>{t("livingScene.allocation.title")}</h4>
      <p className="lsAllocFreed">{t("livingScene.allocation.freed", { amount: sgd(freed) })}</p>

      <div className="lsAllocChoices">
        <button type="button" className={alloc.flexibleMonthly === freed ? "is-on" : ""} onClick={() => s.setAllocation(allToLeg("flexible", freed), null)}>
          {t("livingScene.allocation.keepFlexible")}
        </button>
        <button type="button" className={alloc.emergencyMonthly === freed ? "is-on" : ""} onClick={() => s.setAllocation(allToLeg("emergency", freed), null)}>
          {t("livingScene.allocation.rebuildSafety")}
        </button>
      </div>

      <div className="lsAllocGoal">
        <p className="lsAllocSplitHead">{t("livingScene.allocation.accelerateWhich")}</p>
        <div className="lsAllocChoices">
          {targets.map((g) => (
            <button
              key={g.id}
              type="button"
              className={s.allocationTarget === g.id && alloc.goalMonthly > 0 ? "is-on" : ""}
              onClick={() => s.setAllocation(allToLeg("goal", freed), g.id)}
            >
              {g.label ?? t(`livingScene.node.${g.id}`)}
            </button>
          ))}
        </div>
        {s.needsAllocationTarget ? <p className="lsAllocOver">{t("livingScene.allocation.pickTarget")}</p> : null}
      </div>

      <div className="lsAllocSplit">
        <p className="lsAllocSplitHead">{t("livingScene.allocation.split")}</p>
        {LEGS.map(({ leg, key, labelKey }) => (
          <label key={leg} className="lsAllocSlider">
            <span>{t(labelKey)}</span>
            <input
              type="range"
              min="0"
              max={Math.max(freed, 1)}
              step="10"
              value={Math.min(alloc[key], freed)}
              onChange={(e) => setLeg(key, Number(e.target.value))}
              aria-label={t(labelKey)}
            />
            <b>{sgd(alloc[key])}</b>
          </label>
        ))}
      </div>

      <p className={s.allocationOverspent ? "lsAllocOver" : "lsAllocRemaining"}>
        {s.allocationOverspent
          ? t("livingScene.allocation.overspent", { amount: sgd(sum - freed) })
          : t("livingScene.allocation.remaining", { amount: sgd(remaining) })}
      </p>
      <p className="lsProvenance">{t("livingScene.allocation.noAutoMove")}</p>
    </section>
  );
}

// ---- turning point --------------------------------------------------
function TurningPointMoment({ t }) {
  const s = useLivingScene();
  const tp = s.turningPoint;
  const whyNow = tp?.whyNowKey ? t(tp.whyNowKey, tp.whyNowParams) : tp?.whyNow;
  const ifWait = tp?.ifYouWaitKey ? t(tp.ifYouWaitKey, tp.ifYouWaitParams) : tp?.ifYouWait;
  return (
    <section className="lsOutlet lsTpMoment" aria-label={t("livingScene.phase.turningPoint")}>
      <h4>{t("livingScene.phase.turningPoint")}</h4>
      <p className="lsTpWhy">{whyNow ?? t("livingScene.turningPoint.generic")}</p>
      {ifWait ? <p className="lsProvenance">{t("livingScene.turningPoint.ifYouWait", { text: ifWait })}</p> : null}
      <button type="button" className="lsPrimaryBtn" onClick={s.acknowledgeTurningPoint}>
        {t("livingScene.turningPoint.acknowledge")}
      </button>
    </section>
  );
}

// ---- committed ----------------------------------------------------
function SealedReceipt({ t, sealMonthlyAmount }) {
  const s = useLivingScene();
  const amt = s.sealState.commitment?.monthly_contribution ?? s.sealState.commitment?.monthlyContribution ?? sealMonthlyAmount;
  return (
    <section className="lsOutlet lsSealedReceipt" aria-label={t("livingScene.committed.title")}>
      <p className="lsSealedTick">✓ {t("livingScene.committed.sealedHead")}</p>
      <p className="lsCommittedAmount">{sgd(amt)}/mo</p>
      <p className="lsProvenance">{t("livingScene.committed.revocable")}</p>
    </section>
  );
}

// ---- guardian --------------------------------------------------
function GuardianWatch({ t }) {
  const s = useLivingScene();
  const sp = s.shadowPreview;
  return (
    <section className="lsOutlet lsGuardianWatch" aria-label={t("livingScene.guardian.title")}>
      <p className="lsGuardianState">● {t("livingScene.guardian.watching")}</p>
      <button type="button" className="lsGhostBtn" onClick={() => s.stressTest()} disabled={sp.status === "running"}>
        {sp.status === "running" ? t("livingScene.guardian.rehearsing") : t("livingScene.guardian.stressTest")}
      </button>
      {sp.status === "ready" ? (
        <p className={sp.data?.needsAChoice ? "lsGuardianAlert" : "lsProvenance"}>
          {sp.data?.needsAChoice ? t("livingScene.guardian.wouldNeedChoice") : t("livingScene.guardian.rehearsedClear")}
        </p>
      ) : null}
      {sp.status === "error" ? <p className="lsProvenance">{t("livingScene.guardian.stressError")}</p> : null}
      <p className="lsProvenance">{t("livingScene.guardian.neverMoves")}</p>
    </section>
  );
}
