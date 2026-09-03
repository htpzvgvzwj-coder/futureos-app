"use client";

// "What you've done here" — a small, uniform history record shown at the
// foot of every feature. Collapsed by default; opens to a compact,
// newest-first timeline built from the app's real Change Ledger + audit
// trail (GET /api/history?feature=). Nothing is invented.

import { useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import { relTime } from "./format.js";

export function FeatureHistory({ feature, label = "Your history here" }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    if (!open || events) return;
    fetch(`/api/history?feature=${encodeURIComponent(feature)}`, { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, [open, events, feature]);

  return (
    <section className={css.section}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ width: "100%", background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "13px 2px", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", textAlign: "left", display: "flex", justifyContent: "space-between", cursor: "pointer" }}
      >
        <span>{label}</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        events == null ? (
          <p className={css.micro}>Loading…</p>
        ) : events.length === 0 ? (
          <p className={css.micro}>Nothing yet — what you do here will show up as a record.</p>
        ) : (
          <div className={css.activity}>
            {events.map((e, i) => (
              <div key={i} className={css.actItem}>
                <span className={css.actBody}>
                  <span className={css.actName}>{e.what}</span>
                  <span className={css.actMeta}>
                    {e.actor === "guardian" ? "a linked guardian · " : ""}
                    {relTime(e.when)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
