"use client";

// Life Memory — scroll back along the thread. The same vertical line, but
// receding into the past: every dated change from the Change Ledger, newest
// first, with what moved and its before → after. Read-only. Built from
// fb.ledger (already loaded by the provider) — nothing new fetched, nothing
// invented.

import { useState } from "react";
import css from "../../showcase/fb.module.css";
import life from "./life.module.css";
import { useTx } from "./i18n.jsx";
import { relTime } from "./format.js";

const humanize = (s) => String(s || "").replace(/[_:.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

function movedLine(ev) {
  const set = Array.isArray(ev.impact_set) ? ev.impact_set : [];
  const first = set.find((e) => e && e.before != null && e.after != null && e.before !== e.after);
  if (!first) return ev.uncertainty_note || null;
  const unit = /month|_per_month/.test(first.unit || "") || /month/i.test(first.metric || "");
  const f = (v) => (first.unit === "sgd" || first.unit === "sgd_per_month" ? sgd(v) : String(v));
  return `${humanize(first.metric)}: ${f(first.before)}${unit ? "/mo" : ""} → ${f(first.after)}${unit ? "/mo" : ""}`;
}

export function LifeMemory({ events }) {
  const { tx } = useTx();
  const [limit, setLimit] = useState(6);

  const rows = (Array.isArray(events) ? events : [])
    .filter((e) => e.occurred_at)
    .slice(0, limit);

  if (rows.length === 0) {
    return <p className={css.micro}>{tx("Your line has no past yet — changes you make will pile up here.")}</p>;
  }

  return (
    <div className={life.memory}>
      {rows.map((ev, i) => (
        <div key={ev.id ?? i} className={life.memoryNode}>
          <span className={life.memoryDot} />
          <div className={life.memoryBody}>
            <span className={life.memoryWhen}>{relTime(ev.occurred_at)}</span>
            <span className={life.memoryWhat}>
              {tx(humanize(ev.action_type))}
              {ev.actor === "guardian" ? ` · ${tx("Guardian")}` : ev.actor === "partner" ? ` · ${tx("partner")}` : ""}
            </span>
            {movedLine(ev) ? <span className={life.memoryMoved}>{movedLine(ev)}</span> : null}
          </div>
        </div>
      ))}
      {(events?.length ?? 0) > limit ? (
        <button type="button" className={css.link} onClick={() => setLimit((n) => n + 8)}>{tx("Further back")}</button>
      ) : null}
    </div>
  );
}
