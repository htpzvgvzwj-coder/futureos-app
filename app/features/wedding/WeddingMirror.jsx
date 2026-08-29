"use client";

// Wedding Mirror - compare the current plan against up to two branches.
// Only the dimensions that actually differ are shown. Uses the real branch
// data + projected cross-goal impacts already on field.possiblePaths - no
// front-end duplication of the maths.

import { useState } from "react";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

function rowsFor(entry) {
  const f = entry.feasibility ?? {};
  const p = entry.projectedImpacts ?? null;
  return {
    guests: entry.data?.guest_count ?? f.guestCount ?? null,
    total: f.planTotal ?? f.totalBudget ?? null,
    personalMonthly: f.userRequiredMonthly ?? f.requiredMonthly ?? null,
    partnerMonthly: f.partnerMonthly ?? entry.data?.partner_contribution ?? 0,
    homeMonths: p?.home?.monthsDelta ?? null,
    emergencyAfter: p?.emergency?.bufferAfter ?? null,
    sealable: f.sealable ?? null,
    unresolved: (f.unresolvedItems ?? []).length,
  };
}

export function WeddingMirror({ field, t, call, reload, busy, onSealed }) {
  const reality = {
    id: "reality",
    label: t("weddingLivingPlan.mirror.currentPlan"),
    data: field?.realityPath?.data,
    feasibility: field?.realityPath?.feasibility,
    projectedImpacts: null,
  };
  const open = (field?.possiblePaths ?? []).filter((b) => b.status === "open");
  const [picked, setPicked] = useState(open.slice(0, 2).map((b) => b.id));
  const [sealMsg, setSealMsg] = useState("");

  const entries = [reality, ...open.filter((b) => picked.includes(b.id))].slice(0, 3);
  const cells = entries.map(rowsFor);

  const differs = (key) => new Set(cells.map((c) => JSON.stringify(c[key]))).size > 1;
  const DIMENSIONS = [
    { key: "guests", label: "guests" },
    { key: "total", label: "total", fmt: sgd },
    { key: "personalMonthly", label: "personalMonthly", fmt: (v) => (v == null ? "—" : `${sgd(v)}/mo`) },
    { key: "partnerMonthly", label: "partnerMonthly", fmt: (v) => `${sgd(v)}/mo` },
    { key: "homeMonths", label: "homeImpact", fmt: (v) => (v == null ? "—" : v === 0 ? t("weddingLivingPlan.mirror.noChange") : t(`weddingLivingPlan.mirror.home${v < 0 ? "Earlier" : "Later"}`, { months: Math.abs(v) })) },
    { key: "emergencyAfter", label: "emergency", fmt: (v) => (v == null ? "—" : t("weddingLivingPlan.mirror.buffer", { months: v })) },
    { key: "unresolved", label: "unresolved", fmt: (v) => (v ? t("weddingLivingPlan.mirror.unresolvedCount", { count: v }) : t("weddingLivingPlan.mirror.none")) },
  ];

  const seal = async (branchId, amount) => {
    setSealMsg("");
    const preview = await call(`/api/future-field/seal`, { domain: "wedding", mode: "preview", monthlyAmount: amount, branchId });
    if (!preview.ok) {
      setSealMsg(t(`futureField.err.${preview.data.error}`) === `futureField.err.${preview.data.error}` ? t("weddingLivingPlan.mirror.sealBlocked") : t(`futureField.err.${preview.data.error}`));
      return;
    }
    if (preview.data.preview?.sealable === false) {
      setSealMsg(t("weddingLivingPlan.mirror.sealBlockedBudget"));
      return;
    }
    const confirm = await call(`/api/future-field/seal`, { domain: "wedding", mode: "confirm", monthlyAmount: amount, branchId });
    if (confirm.ok) {
      setSealMsg(t("weddingLivingPlan.mirror.sealed"));
      await reload();
      onSealed?.(confirm.data);
    } else {
      setSealMsg(t("weddingLivingPlan.mirror.sealBlocked"));
    }
  };

  return (
    <section className="wlpView wlpMirror" aria-labelledby="wlpMirrorTitle">
      <h3 id="wlpMirrorTitle">{t("weddingLivingPlan.mirror.title")}</h3>
      <p className="wlpMuted">{t("weddingLivingPlan.mirror.help")}</p>

      {open.length === 0 ? (
        <p className="wlpMuted">{t("weddingLivingPlan.mirror.noBranches")}</p>
      ) : (
        <>
          <fieldset className="wlpMirrorPick">
            <legend>{t("weddingLivingPlan.mirror.pick")}</legend>
            {open.map((b) => (
              <label key={b.id}>
                <input
                  type="checkbox"
                  checked={picked.includes(b.id)}
                  onChange={(e) => {
                    setPicked((cur) => {
                      if (e.target.checked) return [...cur, b.id].slice(-2);
                      return cur.filter((x) => x !== b.id);
                    });
                  }}
                />
                {b.label}
              </label>
            ))}
          </fieldset>

          <div className="wlpMirrorTable" role="table">
            <div className="wlpMirrorRow wlpMirrorHead" role="row">
              <span role="columnheader" />
              {entries.map((e) => (
                <span key={e.id} role="columnheader">{e.label}</span>
              ))}
            </div>
            {DIMENSIONS.filter((d) => differs(d.key)).map((d) => (
              <div className="wlpMirrorRow" role="row" key={d.key}>
                <span role="rowheader">{t(`weddingLivingPlan.mirror.dim.${d.label}`)}</span>
                {cells.map((c, i) => (
                  <span key={i} role="cell">{d.fmt ? d.fmt(c[d.key]) : c[d.key] ?? "—"}</span>
                ))}
              </div>
            ))}
            {DIMENSIONS.every((d) => !differs(d.key)) ? (
              <p className="wlpMuted">{t("weddingLivingPlan.mirror.identical")}</p>
            ) : null}
          </div>

          <div className="wlpMirrorSeal">
            {entries.slice(1).map((e, i) => {
              const cell = cells[i + 1];
              return (
                <button
                  key={e.id}
                  type="button"
                  className="secondaryButton"
                  disabled={busy || cell.sealable === false || cell.personalMonthly == null}
                  onClick={() => seal(e.id, cell.personalMonthly)}
                >
                  {cell.sealable === false
                    ? t("weddingLivingPlan.mirror.cannotSeal", { label: e.label })
                    : t("weddingLivingPlan.mirror.sealThis", { label: e.label })}
                </button>
              );
            })}
          </div>
          {sealMsg ? <p className="wlpMirrorMsg" role="status">{sealMsg}</p> : null}
        </>
      )}
    </section>
  );
}
