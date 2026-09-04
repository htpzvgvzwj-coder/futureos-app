"use client";

// Life Memory — why your money life became what it is.
//
//   collapsed : the single most recent important change, + "View Life
//               Memory →". Never the whole history at once.
//   open      : a vertical timeline tied to the Life Thread — Today /
//               This month / Earlier / Your starting point. Each record
//               answers five things; tap it for the before/after evidence.

import { useState } from "react";
import css from "../../showcase/fb.module.css";
import life from "./life.module.css";
import { useTx } from "./i18n.jsx";
import { relTime } from "./format.js";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

const DOMAIN_NODE = { home: "home", wedding: "relationships", family: "relationships", emergency: "safety", investment: "freedom", retirement: "future" };

function Record({ r, tx, replayable, onReplay, onExplore }) {
  const [open, setOpen] = useState(false);
  const branchNode = r.domain ? DOMAIN_NODE[r.domain] : null;
  return (
    <div className={life.memRec}>
      <span className={`${life.memDot} ${r.id === "starting-point" ? life.memDotStart : ""}`} />
      <div className={life.memBody}>
        {r.when ? <span className={life.memWhen}>{relTime(r.when)}</span> : null}
        <span className={life.memWhat}>{tx(r.what)}</span>
        <span className={life.memWhy}>{tx(r.why)}</span>
        {r.detailKey || r.detail ? (
          <span className={life.memWhy}>{tx(r.detailKey ?? r.detail, r.detailParams)}</span>
        ) : null}

        {r.money ? (
          <span className={life.memMoney}>
            {tx(r.money.label)}: {sgd(r.money.before)} → <b>{sgd(r.money.after)}</b>
          </span>
        ) : null}
        {r.plansMoved.map((p, i) => (
          <span key={i} className={life.memPlan}>{p.key ? tx(p.key, { ...p.params, name: tx(p.params?.name) }) : p.text}</span>
        ))}
        {r.guardian ? <span className={life.memGuardian}>{tx(r.guardian)}</span> : null}
        <span className={life.memSource}>{tx("Source")}: {tx(r.source)}</span>

        {replayable && onReplay ? (
          <button type="button" className={life.memReplay} onClick={() => onReplay(r.id, r.when)}>
            {tx("See your line as it was then")} →
          </button>
        ) : null}
        {branchNode && onExplore ? (
          <button type="button" className={life.memReplay} onClick={() => onExplore(branchNode)}>
            {tx("Explore a different choice here")} →
          </button>
        ) : null}

        {r.evidence ? (
          <>
            <button type="button" className={life.memMore} onClick={() => setOpen(!open)}>
              {open ? tx("Hide the evidence") : tx("Show the evidence")}
            </button>
            {open ? (
              <div className={life.memEvidence}>
                {(r.evidence.impactSet || []).map((im, i) => (
                  <span key={i} className={css.micro}>
                    {im.goalId} · {im.metric}: {String(im.before ?? "—")} → {String(im.after ?? "—")} {im.unit || ""}
                  </span>
                ))}
                <span className={css.micro}>
                  {tx("Confirmed")}: {r.confirmed ? tx("yes") : tx("no")} · {tx("Reversible")}: {r.reversible ? tx("yes") : tx("no")}
                  {r.planVersion ? ` · ${tx("plan version")} ${String(r.planVersion).slice(0, 8)}` : ""}
                </span>
                {r.evidence.confidence ? <span className={css.micro}>{tx("confidence")}: {r.evidence.confidence}</span> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function LifeMemory({ memory, open, onToggle, replayableIds = [], onReplay, onExplore }) {
  const { tx } = useTx();
  const replaySet = new Set(replayableIds);
  const sp = memory?.startingPoint;

  // Collapsed: the two most recent records only — the full history is one tap away.
  const recent = (memory?.records ?? []).slice(0, 2);

  if (!open) {
    return (
      <div className={life.memLatest}>
        <span className={life.memLatestKicker}>{tx(recent.length ? "Latest movements" : "Your starting point")}</span>
        {recent.length ? (
          recent.map((r, i) => (
            <div key={r.id ?? i} className={life.memRecent}>
              <span className={life.memLatestHead}>{tx(r.what)}</span>
              {r.why ? <span className={life.memLatestLine}>{tx(r.why)}</span> : null}
              {(r.plansMoved ?? []).slice(0, 1).map((p, j) => (
                <span key={j} className={life.memLatestLine}>
                  {p.key ? tx(p.key, { ...p.params, name: p.params?.name ? tx(p.params.name) : undefined }) : p.text}
                </span>
              ))}
            </div>
          ))
        ) : (
          <span className={life.memLatestLine}>{tx(sp?.detailKey ?? sp?.detail ?? "Add an account or a plan and your line begins.", sp?.detailParams)}</span>
        )}
        <button type="button" className={life.memOpen} onClick={onToggle}>{tx("View full Life Memory")} →</button>
      </div>
    );
  }

  return (
    <div className={life.memOpenWrap}>
      <button type="button" className={life.memOpen} onClick={onToggle}>← {tx("Back to now")}</button>
      <div className={life.memTimeline}>
        {(memory?.buckets ?? []).map((b) => (
          <div key={b.id} className={life.memBucket}>
            <span className={life.memBucketLabel}>{tx(b.label)}</span>
            {b.records.map((r) => (
              <Record key={r.id} r={r} tx={tx} replayable={replaySet.has(r.id)} onReplay={onReplay} onExplore={onExplore} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
