"use client";

// ProtectionEnvelopeScene - the Insurance Studio's native surface.
//
// A stretchable protection boundary around real life nodes: Income, Home
// loan, Family, Care, plus existing commitments. Each node is one of four
// visible states - Confirmed / Partial / Unknown / Known gap - and an
// Unknown is NEVER drawn as a gap. Tapping a node shows the data used, lets
// the customer confirm or add what they already hold, choose whether it
// sits inside the envelope, and see the monthly pressure protecting it
// would add. No product is sold, no underwriting, no quote.

import { useMemo, useState } from "react";
import { computeProtectionEnvelope } from "../../../lib/insurance/protection-finance.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";
import { DragTrack } from "../../components/living-scene/DragTrack.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const PREMIUM_PER_1000_PER_MONTH = 0.35 / 12;
function premiumForGap(gap) {
  return Math.round((Math.max(0, Number(gap) || 0) / 1000) * PREMIUM_PER_1000_PER_MONTH * 100) / 100;
}
const INS_KEYS = ["monthly_premium_now", "income_protection_months", "existing_income_protection", "existing_life_cover", "existing_ci_cover", "home_loan_outstanding", "dependents"];
const NODE_COVER_KEY = { income: "existing_income_protection", home_loan: "existing_life_cover", family: "existing_life_cover", care: "existing_ci_cover" };

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of INS_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}

function nodeState(n) {
  if (n.status === "unknown") return "unknown";
  if (n.status === "partial") return "partial";
  return n.gapAmount > 0 ? "gap" : "covered";
}

// pure - shares computeProtectionEnvelope with lib/future-field/adapters.js
export function projectEnvelope({ branchVars, reality }) {
  const rf = computeProtectionEnvelope({ planData: reality });
  const bf = computeProtectionEnvelope({ planData: merged(reality, branchVars) });
  const premBefore = Number(reality.monthly_premium_now) || 0;
  const closed = Math.max(0, rf.quantifiedGap - bf.quantifiedGap);
  const impliedExtra = premiumForGap(closed);
  const premAfter = branchVars.monthly_premium_now != null ? Number(branchVars.monthly_premium_now) : premBefore + impliedExtra;
  const addedPressure = Math.max(0, Math.round((premAfter - premBefore) * 100) / 100);
  const freedCashflow = Math.max(0, Math.round((premBefore - premAfter) * 100) / 100);
  const dir = bf.quantifiedGap < rf.quantifiedGap ? "down" : bf.quantifiedGap > rf.quantifiedGap ? "up" : "flat";

  const nodes = [];
  for (const bn of bf.nodes) {
    const rn = rf.nodes.find((x) => x.id === bn.id);
    if (!rn) continue;
    if ((bn.gapAmount ?? 0) !== (rn.gapAmount ?? 0) || bn.status !== rn.status) {
      nodes.push({ id: `protect_${bn.id}`, dir: (bn.gapAmount ?? 0) < (rn.gapAmount ?? 0) ? "up" : "down", note: nodeState(bn) });
    }
  }
  if (addedPressure > 0) nodes.push({ id: "cashflow", dir: "down", note: `-${sgd(addedPressure)}/mo` });

  return {
    selfOutcome: { metric: "protectionGap", before: rf.quantifiedGap, after: bf.quantifiedGap, unit: "sgd", dir },
    nodes,
    freedCashflow,
    addedPressure,
    mode: addedPressure > 0 ? "pressure" : freedCashflow > 0 ? "freed" : "neutral",
    envelope: bf,
    premAfter: Math.round(premAfter * 100) / 100,
    impliedExtra,
  };
}

function insuranceTurningPoint({ branchVars }) {
  // Only after a NEW responsibility is added (home loan / dependents).
  if (branchVars.home_loan_outstanding != null || branchVars.dependents != null) {
    return { id: "ins-new-responsibility", whyNowKey: "protectionEnvelope.turningPoint.newResponsibility", ifYouWaitKey: "protectionEnvelope.turningPoint.newResponsibilityWait" };
  }
  return null;
}

function ProtectionEnvelopeInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [open, setOpen] = useState(null);

  const env = useMemo(() => {
    if (!reality) return null;
    return s.projection?.envelope ?? computeProtectionEnvelope({ planData: merged(reality, s.branchVars) });
  }, [reality, s.branchVars, s.projection]);

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("protectionEnvelope.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !env) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("protectionEnvelope.title")}</h1></header>
        <p className="wlpEmpty">{t("protectionEnvelope.noData")}</p>
      </section>
    );
  }

  const premBefore = Number(reality.monthly_premium_now) || 0;
  const premAfter = s.projection?.premAfter ?? premBefore;
  const setCover = (nodeId, value) => {
    const key = NODE_COVER_KEY[nodeId];
    if (key) s.setVar(key, Math.max(0, Math.round(value)));
  };

  return (
    <section className="screen wlpScreen lsSceneScreen">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("protectionEnvelope.title")}</h1>
        <p>{t("protectionEnvelope.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }]}
        realitySummary={t("protectionEnvelope.summaryLine", { premium: `${sgd(premBefore)}/mo`, gaps: feas.knownGapCount, unknown: feas.unknownCount })}
        sealMonthlyAmount={Math.max(premAfter, premBefore)}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "premium", label: t("protectionEnvelope.reality.premium"), value: `${sgd(premBefore)}/mo`, provenance: t("protectionEnvelope.reality.declared") },
          { id: "known", label: t("protectionEnvelope.reality.knownGaps"), value: String(feas.knownGapCount), provenance: t("protectionEnvelope.reality.fromDeclared") },
          { id: "unknown", label: t("protectionEnvelope.reality.unknowns"), value: String(feas.unknownCount), provenance: t("protectionEnvelope.reality.notCounted") },
        ]}
        realityUnknowns={env.nodes.filter((n) => n.status === "unknown").map((n) => ({ id: n.id, label: t(`protectionEnvelope.node.${n.id}`) }))}
        realityNote={t("protectionEnvelope.estimateNote")}
      >
        <div className="peScene">
          <div className="peEnvelope" aria-label={t("protectionEnvelope.whatIsCovered")}>
            {env.nodes.map((n) => {
              const st = nodeState(n);
              return (
                <button key={n.id} type="button" className={`peNode peNode-${st} ${open === n.id ? "is-open" : ""}`} onClick={() => setOpen(open === n.id ? null : n.id)}>
                  <span className="peNodeName">{t(`protectionEnvelope.node.${n.id}`)}</span>
                  <span className="peNodeState">
                    {st === "unknown" ? t("protectionEnvelope.status.unknown")
                      : st === "partial" ? t("protectionEnvelope.status.partial")
                      : st === "gap" ? t("protectionEnvelope.gap", { amount: sgd(n.gapAmount) })
                      : t("protectionEnvelope.status.covered")}
                  </span>
                </button>
              );
            })}
          </div>

          {open ? (
            <div className="peNodePanel">
              {(() => {
                const n = env.nodes.find((x) => x.id === open);
                if (!n) return null;
                const coverKey = NODE_COVER_KEY[open];
                const coverNow = Number(merged(reality, s.branchVars)[coverKey]) || 0;
                return (
                  <>
                    <p className="peNodeData">
                      {t("protectionEnvelope.panel.needHave", { need: n.need != null ? sgd(n.need) : t("protectionEnvelope.status.unknown"), have: sgd(n.have) })}
                    </p>
                    {n.status === "unknown" ? <p className="wlpMuted">{t("protectionEnvelope.panel.unknownHelp")}</p> : null}
                    {coverKey ? (
                      <label className="peCoverInput">
                        <span>{t("protectionEnvelope.panel.confirmCover")}</span>
                        <DragTrack min={0} max={Math.max(n.need || 100000, coverNow, 100000)} step={5000} value={coverNow} onChange={(v) => setCover(open, v)} ariaLabel={t("protectionEnvelope.panel.confirmCover")} />
                        <b>{sgd(coverNow)}</b>
                      </label>
                    ) : null}
                    {n.gapAmount > 0 ? (
                      <p className="peNodePremium">{t("protectionEnvelope.panel.premiumToProtect", { amount: sgd(premiumForGap(n.gapAmount)) })}</p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : null}

          {open ? (
            <label className="peSlider">
              <span>{t("protectionEnvelope.totalPremium")}</span>
              <DragTrack min={0} max={Math.max(premBefore * 3, premAfter * 1.5, 300)} step={5} value={Math.round(premAfter)} onChange={(v) => s.setVar("monthly_premium_now", v)} ariaLabel={t("protectionEnvelope.totalPremium")} />
              <b>{sgd(premAfter)}/mo</b>
            </label>
          ) : null}
          {open && s.projection?.impliedExtra > 0 ? <p className="wlpMuted">{t("protectionEnvelope.impliedExtra", { amount: sgd(s.projection.impliedExtra) })}</p> : null}
          <p className="wlpProvenance">{t("protectionEnvelope.noSaleNote")}</p>
        </div>
      </SceneShell>
    </section>
  );
}

export function ProtectionEnvelope({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="insurance" projectFn={projectEnvelope} turningPointFor={insuranceTurningPoint}>
      <ProtectionEnvelopeInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
