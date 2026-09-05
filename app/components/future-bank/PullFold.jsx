"use client";

// Pull the Future + Fork and Fold, for one Life node.
//
//   Pull  — drag the slider; the line's projected impact updates live via
//           /api/future-field/branch?action=preview. Nothing is saved.
//   Fork  — turn the current pull into a real possible path (a branch).
//   Fold  — discard a fork. Keep — make a fork the active moment.
//
// All the machinery already exists in the Future Field; this is the Life
// framing of it. A node with no plan yet shows a route to its Studio.

import { useCallback, useEffect, useRef, useState } from "react";
import css from "../../showcase/fb.module.css";
import life from "./life.module.css";
import { useTx } from "./i18n.jsx";
import { PULLABLE, buildPullSpec, overrideFor, captionFor } from "../../../lib/life/pull.js";
import { parsePullAsk } from "../../../lib/life/parse-pull-ask.js";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

function impactLines(projected, tx) {
  if (!projected) return [];
  const out = [];
  const rd = projected.resourceDelta || {};
  if (rd.freedMonthly > 0) out.push(`${tx("Frees")} ${sgd(rd.freedMonthly)}/${tx("mo")}`);
  if (rd.addedPressureMonthly > 0) out.push(`${tx("Needs")} ${sgd(rd.addedPressureMonthly)}/${tx("mo")} ${tx("more")}`);
  for (const g of projected.affectedGoals || []) {
    const before = g.before ?? null;
    const after = g.possibleAfter ?? g.confirmedAfter ?? null;
    if (before == null || after == null || Number(before) === Number(after)) continue;
    out.push(`${tx(cap(g.goalId))}: ${fmt(before, g.unit)} → ${fmt(after, g.unit)}`);
  }
  return out.slice(0, 4);
}
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
function fmt(v, unit) {
  if (unit === "sgd_per_month") return `${sgd(v)}/mo`;
  if (unit === "sgd") return sgd(v);
  if (unit === "months") return `${Number(v).toFixed(1)} mo`;
  if (unit === "date_shift_months") return `${v > 0 ? "+" : ""}${Number(v).toFixed(0)} mo`;
  return String(v);
}

export function PullFold({ nodeId, onClose, onChanged, onStudio }) {
  const { tx } = useTx();
  const cfg = PULLABLE[nodeId];
  const [field, setField] = useState(null); // /api/future-field payload
  const [spec, setSpec] = useState(null);
  const [slider, setSlider] = useState(0);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);
  const [askText, setAskText] = useState("");
  const [askUnrecognised, setAskUnrecognised] = useState(false);
  const timer = useRef(null);

  const loadField = useCallback(() => {
    if (!cfg) return;
    fetch(`/api/future-field?domain=${cfg.domain}`, { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setField(d);
        if (d?.hasRealityPath) {
          const s = buildPullSpec(nodeId, d.realityPath?.data ?? {});
          setSpec(s);
          setSlider(s?.value ?? 0);
        }
      })
      .catch(() => setField(null));
  }, [cfg, nodeId]);
  useEffect(() => {
    loadField();
  }, [loadField]);

  const runPreview = useCallback(
    (value) => {
      if (!spec) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fetch(`/api/future-field/branch?action=preview&domain=${cfg.domain}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ overrides: overrideFor(spec, value) }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => setPreview(d?.preview ?? null))
          .catch(() => setPreview(null));
      }, 260);
    },
    [spec, cfg],
  );

  const onSlide = (v) => {
    setSlider(v);
    if (Number(v) === Number(spec?.value)) setPreview(null);
    else runPreview(v);
  };

  // A typed request ("6 months sooner", "invest SGD 500 a month") moves
  // the same slider a drag does — not a canned formula, a real parse of
  // this node's own unit (months_shift / months_cushion / sgd_per_month /
  // age), reusing every bit of machinery the slider already has (preview,
  // fork, keep).
  const runAsk = () => {
    const v = parsePullAsk(askText, spec);
    if (v == null) { setAskUnrecognised(true); return; }
    setAskUnrecognised(false);
    onSlide(v);
  };

  const post = async (action, body) => {
    setBusy(action);
    const r = await fetch(`/api/future-field/branch?action=${action}&domain=${cfg.domain}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).catch(() => null);
    setBusy(null);
    return r && r.ok ? r.json() : null;
  };

  const fork = async () => {
    const res = await post("peel", { overrides: overrideFor(spec, slider), label: captionFor(spec, slider).slice(0, 60) });
    if (res) {
      setPreview(null);
      setSlider(spec.value);
      loadField();
    }
  };
  const fold = async (branchId) => {
    if (await post("discard", { branchId })) loadField();
  };
  const keep = async (branchId) => {
    if (await post("activate", { branchId })) {
      loadField();
      onChanged?.();
    }
  };

  const forks = (field?.possiblePaths ?? []).filter((b) => b.status !== "discarded" && b.status !== "merged");

  return (
    <div className={life.pullSheet}>
      <div className={life.pullHead}>
        <span>{tx("Move this goal")} · {tx(cap(nodeId))}</span>
        <button type="button" className={css.link} onClick={onClose}>{tx("Done")}</button>
      </div>

      {field == null ? (
        <p className={css.micro}>{tx("Loading…")}</p>
      ) : !field.hasRealityPath ? (
        <div className={css.calmCard}>
          <b>{tx("Nothing to change here yet.")}</b>
          <span className={css.micro}>{tx("Start this plan in its Studio first, then you can move it here.")}</span>
          <button type="button" className={css.cta} onClick={() => onStudio?.(cfg.domain)}>{tx("Open the Studio")}</button>
        </div>
      ) : (
        <>
          <input
            type="range"
            className={life.pullRange}
            min={spec?.sliderMin ?? 0}
            max={spec?.sliderMax ?? 0}
            step={spec?.step ?? 1}
            value={slider}
            aria-label={tx("Move this goal")}
            onChange={(e) => onSlide(e.target.value)}
          />
          <p className={life.pullCaption}>{spec ? captionFor(spec, slider) : ""}</p>

          <form
            className={life.pullAskRow}
            onSubmit={(e) => { e.preventDefault(); runAsk(); }}
          >
            <input
              type="text"
              className={life.pullAskInput}
              value={askText}
              onChange={(e) => { setAskText(e.target.value); setAskUnrecognised(false); }}
              placeholder={tx("Or type it — \"6 months sooner\", \"invest SGD 500 a month\"…")}
              aria-label={tx("Type a change")}
            />
            <button type="submit" className={life.pullAskGo} disabled={!askText.trim()}>{tx("Go")}</button>
          </form>
          {askUnrecognised ? (
            <span className={life.pullBlock}>{tx("Couldn't read that as a change here — try a number, or drag the slider instead.")}</span>
          ) : null}

          {preview ? (
            <div className={life.pullImpact}>
              {impactLines(preview.projectedImpacts, tx).map((l, i) => (
                <span key={i} className={life.pullImpactRow}>{l}</span>
              ))}
              {impactLines(preview.projectedImpacts, tx).length === 0 ? (
                <span className={css.micro}>{tx("No other plan moves at this setting.")}</span>
              ) : null}
              {preview.sealableVerdict && !preview.sealableVerdict.sealable ? (
                <span className={life.pullBlock}>{tx("Can't be kept yet")} — {tx(preview.sealableVerdict.reason)}</span>
              ) : null}
              <div className={life.pullActs}>
                <button type="button" className={css.cta} disabled={busy != null} onClick={fork}>{tx("Explore this path")}</button>
                <button type="button" className={css.link} disabled={busy != null} onClick={() => onSlide(spec.value)}>{tx("Reset")}</button>
              </div>
            </div>
          ) : (
            <p className={css.micro}>{tx("Drag to see what it affects. Nothing is saved until you explore it as a path.")}</p>
          )}

          {forks.length > 0 ? (
            <div className={life.forkList}>
              <span className={life.forkHead}>{tx("Paths you are exploring")}</span>
              {forks.map((b) => (
                <div key={b.id} className={life.forkRow}>
                  <span className={life.forkLabel}>
                    {b.label}
                    {b.status === "active" ? <span className={life.forkTag}> · {tx("active")}</span> : null}
                  </span>
                  {b.readyMonth ? <span className={css.micro}>{tx("ready")} {b.readyMonth}</span> : null}
                  <div className={life.forkActs}>
                    {b.status !== "active" ? (
                      <button type="button" className={css.link} disabled={busy != null} onClick={() => keep(b.id)}>{tx("Keep")}</button>
                    ) : (
                      <button type="button" className={css.link} disabled={busy != null} onClick={() => keep(null)}>{tx("Back to reality")}</button>
                    )}
                    <button type="button" className={css.link} disabled={busy != null} onClick={() => fold(b.id)}>{tx("Fold")}</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
