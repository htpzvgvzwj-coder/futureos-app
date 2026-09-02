"use client";

// BranchStrip - the shared "real branches" control for every Studio scene.
//
//   Create  - pin the current edits as a named branch (Fork)
//   Select  - make a saved branch the active one (loads its edits back)
//   Compare - a 2+ column diff of what actually differs + freed/pressure
//   Undo    - discard a possible future (kept in history, never deleted)

import { useMemo, useState } from "react";
import { useLivingScene } from "./LivingSceneProvider.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
function deltaKeys(b) {
  const after = b?.delta?.after && typeof b.delta.after === "object" ? b.delta.after : {};
  return Object.keys(after);
}
function resourceLine(b, t) {
  const rd = b?.projectedImpacts?.resourceDelta ?? null;
  if (!rd) return t("branchStrip.noImpact");
  if ((rd.addedPressureMonthly || 0) > 0) return t("branchStrip.pressure", { amount: sgd(rd.addedPressureMonthly) });
  if ((rd.freedMonthly || 0) > 0) return t("branchStrip.freed", { amount: sgd(rd.freedMonthly) });
  return t("branchStrip.neutral");
}

export function BranchStrip({ t }) {
  const s = useLivingScene();
  const branches = s.savedBranches ?? [];
  const [compareOpen, setCompareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  const columns = useMemo(() => {
    const cols = [{ id: "__reality", label: t("branchStrip.reality"), after: {}, sealable: s.reality?.sealableVerdict?.sealable, res: null }];
    for (const b of branches) {
      cols.push({ id: b.id, label: b.label, after: b.delta?.after ?? {}, sealable: b.sealableVerdict?.sealable, res: b.projectedImpacts?.resourceDelta ?? null });
    }
    return cols;
  }, [branches, s.reality, t]);

  const allKeys = useMemo(() => {
    const set = new Set();
    for (const b of branches) for (const k of deltaKeys(b)) set.add(k);
    return [...set];
  }, [branches]);

  const fork = async () => {
    if (busy || !s.branchDirty) return;
    setBusy(true);
    try {
      await s.forkBranch(name || t("branchStrip.defaultName", { n: branches.length + 1 }));
      setName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lsBranchStrip" aria-label={t("branchStrip.title")}>
      <div className="lsBranchRow">
        <span className="lsBranchLabel">{t("branchStrip.title")}</span>
        <button type="button" className="lsGhostBtn" disabled={busy || !s.branchDirty} onClick={fork}>{t("branchStrip.fork")}</button>
        {branches.length >= 2 ? (
          <button type="button" className="lsGhostBtn" aria-expanded={compareOpen} onClick={() => setCompareOpen((x) => !x)}>
            {t(compareOpen ? "branchStrip.hideCompare" : "branchStrip.compare")}
          </button>
        ) : null}
      </div>

      {branches.length === 0 ? (
        <p className="lsBranchEmpty">{t("branchStrip.empty")}</p>
      ) : (
        <ul className="lsBranchList">
          {branches.map((b) => (
            <li key={b.id} className={s.serverBranch?.id === b.id ? "is-active" : ""}>
              <button type="button" className="lsBranchPick" onClick={() => s.selectBranch(b.id)}>
                <b>{b.label}</b>
                <em>{resourceLine(b, t)}</em>
                <span className={b.sealableVerdict?.sealable ? "lsBranchSealOk" : "lsBranchSealNo"}>
                  {b.sealableVerdict?.sealable ? t("branchStrip.sealable") : t("branchStrip.notSealable")}
                </span>
              </button>
              <button type="button" className="lsBranchDiscard" aria-label={t("branchStrip.discard")} onClick={() => s.discardBranch(b.id)}>×</button>
            </li>
          ))}
        </ul>
      )}

      {compareOpen && branches.length >= 2 ? (
        <div className="lsBranchCompare" role="table">
          <div className="lsBranchCompareHead" role="row">
            <span role="columnheader">{t("branchStrip.field")}</span>
            {columns.map((c) => (
              <span key={c.id} role="columnheader">{c.label}</span>
            ))}
          </div>
          {allKeys.map((k) => (
            <div key={k} className="lsBranchCompareRow" role="row">
              <span role="cell">{k}</span>
              {columns.map((c) => (
                <span key={c.id} role="cell">{c.after[k] == null ? "—" : String(c.after[k])}</span>
              ))}
            </div>
          ))}
          <div className="lsBranchCompareRow" role="row">
            <span role="cell">{t("branchStrip.monthlyEffect")}</span>
            {columns.map((c) => (
              <span key={c.id} role="cell">
                {!c.res ? "—" : (c.res.addedPressureMonthly || 0) > 0 ? `+${sgd(c.res.addedPressureMonthly)}` : (c.res.freedMonthly || 0) > 0 ? `−${sgd(c.res.freedMonthly)}` : "0"}
              </span>
            ))}
          </div>
          <div className="lsBranchCompareRow" role="row">
            <span role="cell">{t("branchStrip.sealableRow")}</span>
            {columns.map((c) => (
              <span key={c.id} role="cell">{c.sealable ? "✓" : "✗"}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
