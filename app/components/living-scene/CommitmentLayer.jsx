"use client";

// CommitmentLayer - "What did you confirm?"
//
// Turns the explored branch into a real commitment, but only through the
// seal preview: the monthly amount, the data sources, what Guardian may do
// (never move money - no bank-transfer integration exists), the auto-pause
// conditions, that it is a shadow-only simulation, and that it is
// revocable. Nothing is written until the customer confirms that preview.

import { useState } from "react";
import { useLivingScene } from "./LivingSceneProvider.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function CommitmentLayer({ t, monthlyAmount, disabled = false }) {
  const s = useLivingScene();
  const [preview, setPreview] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | preview | done | error
  const amount = Math.max(0, Math.round(Number(monthlyAmount) || 0));

  if (s.sealState.sealed) {
    return (
      <section className="lsLayer lsCommitment is-sealed" aria-label={t("livingScene.committed.title")}>
        <h3>{t("livingScene.committed.title")}</h3>
        <p className="lsCommittedAmount">{sgd(s.sealState.commitment?.monthly_contribution ?? amount)}/mo</p>
        <p className="lsProvenance">{t("livingScene.committed.revocable")}</p>
      </section>
    );
  }

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
    setStage(r.ok ? "done" : "error");
  };

  return (
    <section className="lsLayer lsCommitment" aria-label={t("livingScene.committed.title")}>
      <h3>{t("livingScene.committed.title")}</h3>

      {stage === "idle" || stage === "loading" ? (
        <button type="button" className="lsSealBtn" disabled={disabled || amount <= 0 || stage === "loading"} onClick={openPreview}>
          {t("livingScene.committed.review", { amount: sgd(amount) })}
        </button>
      ) : null}

      {stage === "preview" && preview ? (
        <div className="lsSealPreview">
          <dl>
            <div><dt>{t("livingScene.committed.monthly")}</dt><dd>{sgd(amount)}/mo</dd></div>
            {preview.effectiveMonth ? <div><dt>{t("livingScene.committed.effective")}</dt><dd>{preview.effectiveMonth}</dd></div> : null}
            {preview.readyMonth ? <div><dt>{t("livingScene.committed.ready")}</dt><dd>{preview.readyMonth}</dd></div> : null}
          </dl>
          <ul className="lsSealTerms">
            <li>{t("livingScene.committed.guardianCant")}</li>
            <li>{t("livingScene.committed.shadowOnly")}</li>
            <li>{t("livingScene.committed.autopause")}</li>
            <li>{t("livingScene.committed.revocable")}</li>
          </ul>
          <div className="lsSealActions">
            <button type="button" className="lsSealBtn" disabled={stage === "loading"} onClick={confirm}>
              {t("livingScene.committed.confirm")}
            </button>
            <button type="button" className="lsSealCancel" onClick={() => setStage("idle")}>
              {t("livingScene.committed.notYet")}
            </button>
          </div>
        </div>
      ) : null}

      {stage === "error" ? (
        <p className="lsSealError">
          {s.sealState.error === "budget_below_core" || preview?.sealable === false
            ? t("livingScene.committed.notSealable")
            : t("livingScene.committed.sealError")}
        </p>
      ) : null}
    </section>
  );
}
