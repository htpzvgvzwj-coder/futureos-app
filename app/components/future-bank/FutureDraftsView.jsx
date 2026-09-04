"use client";

// Future Drafts — every possible future you're holding open, across every
// domain, in one place. Not history: these are still open, still
// unconfirmed. Pick two and compare them side by side; open either in its
// Future Field to keep exploring, adjust, or seal it.

import { useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import x from "./explore.module.css";
import { useTx } from "./i18n.jsx";

const DOMAIN_LABEL = { home: "Home", wedding: "Wedding", emergency: "Safety", family: "Family", investment: "Freedom", retirement: "Retirement", loan: "Loan", travel: "Travel", insurance: "Protection" };
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());
const fmt = (v) => {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-SG") : v.toFixed(1);
  return String(v).slice(0, 24);
};
const humanKey = (k) => String(k || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function FutureDraftsView({ onBack, onOpen }) {
  const { tx } = useTx();
  const [drafts, setDrafts] = useState(null);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState([]); // up to 2 draft ids for compare

  useEffect(() => {
    fetch("/api/future-field/drafts", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setDrafts(d.drafts ?? []))
      .catch(() => setErr(tx("Could not load your drafts.")));
  }, [tx]);

  const toggle = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x2) => x2 !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]));
  const a = drafts?.find((d) => d.id === picked[0]);
  const b = drafts?.find((d) => d.id === picked[1]);
  const allKeys = a && b ? [...new Set([...a.changedKeys, ...b.changedKeys])] : [];

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← {tx("Explore")}</button>
        <div>
          <h1 className={css.title}>{tx("Future Drafts")}</h1>
          <p className={css.micro}>{tx("Every possible future you're holding open, across every plan. Nothing here is committed.")}</p>
        </div>

        {err ? <p className={css.micro}>{err}</p> : null}
        {drafts == null && !err ? <p className={css.micro}>{tx("Loading…")}</p> : null}
        {drafts && drafts.length === 0 ? (
          <div className={css.calmCard}>
            <b>{tx("No open drafts right now")}</b>
            <span className={css.micro}>{tx("Peel a branch in any Studio's Future Field and it shows up here.")}</span>
          </div>
        ) : null}

        {drafts && drafts.length > 0 ? (
          <>
            {picked.length === 2 && a && b ? (
              <section className={css.section}>
                <p className={css.kicker}>{tx("Comparing")}</p>
                <div className={x.compareGrid}>
                  <span />
                  <span className={x.delayCol}>{tx(DOMAIN_LABEL[a.domain] ?? cap(a.domain))}</span>
                  <span className={x.delayCol}>{tx(DOMAIN_LABEL[b.domain] ?? cap(b.domain))}</span>
                  {allKeys.map((k) => (
                    <FutureDraftCompareRow key={k} k={k} a={a} b={b} tx={tx} />
                  ))}
                </div>
                <div className={css.choiceGrid}>
                  <button type="button" className={css.cta} onClick={() => onOpen?.(a.domain)}>{tx("Open {name}", { name: tx(DOMAIN_LABEL[a.domain] ?? cap(a.domain)) })}</button>
                  <button type="button" className={css.choice} onClick={() => onOpen?.(b.domain)}>{tx("Open {name}", { name: tx(DOMAIN_LABEL[b.domain] ?? cap(b.domain)) })}</button>
                </div>
              </section>
            ) : (
              <p className={css.micro}>{tx("Pick two drafts below to compare them.")}</p>
            )}

            <section className={css.section}>
              <p className={css.kicker}>{tx("Open drafts")}</p>
              {drafts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`${css.zoneRow} ${picked.includes(d.id) ? x.draftPicked : ""}`}
                  onClick={() => toggle(d.id)}
                  aria-pressed={picked.includes(d.id)}
                >
                  <span className={css.zoneMain}>
                    <span className={css.zoneName}>{picked.includes(d.id) ? "✓ " : ""}{tx(DOMAIN_LABEL[d.domain] ?? cap(d.domain))} — {d.label}</span>
                    <span className={css.zoneSolves}>
                      {d.changedKeys.slice(0, 2).map((k) => `${humanKey(k)}: ${fmt(d.before[k])} → ${fmt(d.after[k])}`).join(" · ") || tx("No changes recorded")}
                    </span>
                  </span>
                  <span className={`${css.zoneStatus} ${d.isActive ? css.live : css.soon}`}>{d.isActive ? tx("Active") : tx("Draft")}</span>
                </button>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FutureDraftCompareRow({ k, a, b, tx }) {
  return (
    <>
      <span>{tx(humanKey(k))}</span>
      <span>{fmt(a.after[k] ?? a.before[k])}</span>
      <span>{fmt(b.after[k] ?? b.before[k])}</span>
    </>
  );
}
