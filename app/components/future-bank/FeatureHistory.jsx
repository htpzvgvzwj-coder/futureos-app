"use client";

// "What you've done here" — a small, uniform history record. The default
// form sits at the foot of a feature (its own bordered section); the
// `compact` form nests inside a sub-section (no section chrome, lighter
// type). Both are collapsed by default and open to a newest-first timeline
// built from the app's real Change Ledger + audit trail
// (GET /api/history?feature=). Nothing is invented.

import { useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import { relTime } from "./format.js";
import { useTx } from "./i18n.jsx";

export function FeatureHistory({ feature, label = "Your history here", compact = false }) {
  const { tx } = useTx();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    if (!open || events) return;
    fetch(`/api/history?feature=${encodeURIComponent(feature)}`, { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, [open, events, feature]);

  const Wrapper = compact ? "div" : "section";
  const wrapperClass = compact ? "" : css.section;
  const btnStyle = compact
    ? { width: "100%", background: "none", border: 0, padding: "8px 0 2px", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--ink-faint)", textAlign: "left", display: "flex", justifyContent: "space-between", cursor: "pointer" }
    : { width: "100%", background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "13px 2px", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", textAlign: "left", display: "flex", justifyContent: "space-between", cursor: "pointer" };

  return (
    <Wrapper className={wrapperClass}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={btnStyle}>
        <span>{tx(label)}</span>
        <span>{open ? tx("Hide") : tx("Show")}</span>
      </button>
      {open ? (
        events == null ? (
          <p className={css.micro}>{tx("Loading…")}</p>
        ) : events.length === 0 ? (
          <p className={css.micro}>{tx("Nothing yet — what you do here will show up as a record.")}</p>
        ) : (
          <div className={css.activity}>
            {events.map((e, i) => (
              <div key={i} className={css.actItem}>
                <span className={css.actBody}>
                  <span className={css.actName}>{tx(e.what)}</span>
                  <span className={css.actMeta}>
                    {e.actor === "guardian" ? `${tx("a linked guardian")} · ` : ""}
                    {relTime(e.when)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </Wrapper>
  );
}
