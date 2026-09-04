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
import { latestMovementLine } from "../../../lib/life/memory.js";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

function Record({ r, tx, replayable, onReplay }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={life.memRec}>
      <span className={`${life.memDot} ${r.id === "starting-point" ? life.memDotStart : ""}`} />
      <div className={life.memBody}>
        {r.when ? <span className={life.memWhen}>{relTime(r.when)}</span> : null}
        <span className={life.memWhat}>{tx(r.what)}</span>
        <span className={life.memWhy}>{tx(r.why)}</span>
        {r.detail ? <span className={life.memWhy}>{tx(r.detail)}</span> : null}

        {r.money ? (
          <span className={life.memMoney}>
            {tx(r.money.label)}: {sgd(r.money.before)} → <b>{sgd(r.money.after)}</b>
          </span>
        ) : null}
        {r.plansMoved.map((p, i) => (
          <span key={i} className={life.memPlan}>{p}</span>
        ))}
        {r.guardian ? <span className={life.memGuardian}>{tx(r.guardian)}</span> : null}
        <span className={life.memSource}>{tx("Source")}: {tx(r.source)}</span>

        {replayable && onReplay ? (
          <button type="button" className={life.memReplay} onClick={() => onReplay(r.id, r.when)}>
            {tx("See your line as it was then")} →
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

export function LifeMemory({ memory, open, onToggle, replayableIds = [], onReplay }) {
  const { tx } = useTx();
  const replaySet = new Set(replayableIds);
  const latest = latestMovementLine(memory);
  const sp = memory?.startingPoint;

  if (!open) {
    return (
      <div className={life.memLatest}>
        <span className={life.memLatestKicker}>{tx(latest ? "Latest movement" : "Your starting point")}</span>
        {latest ? (
          <>
            <span className={life.memLatestHead}>{tx(latest.headline)}</span>
            {latest.lines.map((l, i) => (
              <span key={i} className={life.memLatestLine}>{l}</span>
            ))}
          </>
        ) : (
          <span className={life.memLatestLine}>{tx(sp?.detail || "Add an account or a plan and your line begins.")}</span>
        )}
        <button type="button" className={life.memOpen} onClick={onToggle}>{tx("View Life Memory")} →</button>
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
              <Record key={r.id} r={r} tx={tx} replayable={replaySet.has(r.id)} onReplay={onReplay} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
