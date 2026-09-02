"use client";

// ThreadMemoryScrubber - drag back through the real Change Ledger events on
// the thread and see the Before / After of each. Reads `events` (meaningful
// ledger events only) + the current `lastChange`. No second history engine:
// it just indexes the list it is handed.

import { useState } from "react";
import styles from "./living-thread.module.css";

export function ThreadMemoryScrubber({ events = [], lastChange = null }) {
  const frames = events.length ? events : lastChange ? [lastChange] : [];
  const [i, setI] = useState(Math.max(0, frames.length - 1));
  // A scrubber is only useful when there are at least two real states to
  // compare. One event rendered as a disabled-looking slider confused
  // customers and created a large empty block on the Life screen.
  if (frames.length < 2) return null;
  const f = frames[Math.min(i, frames.length - 1)];
  return (
    <div className={styles.rail} data-testid="lt-memory-scrubber">
      <p className={styles.railTitle}>Memory Scrubber</p>
      <div className={styles.scrub}>
        <label className={styles.visuallyHidden} htmlFor="lt-scrub">
          Scrub through past changes
        </label>
        <span className={styles.railMuted}>oldest</span>
        <input
          id="lt-scrub"
          type="range"
          min={0}
          max={frames.length - 1}
          value={Math.min(i, frames.length - 1)}
          onChange={(e) => setI(Number(e.target.value))}
        />
        <span className={styles.railMuted}>now</span>
      </div>
      <p>
        <strong>{f.label ?? f.headline ?? f.kind ?? "change"}</strong>
        {f.at ? ` — ${new Date(f.at).toLocaleDateString()}` : ""}
      </p>
      {f.before != null || f.after != null ? (
        <p className={styles.railMuted}>
          before: {String(f.before ?? "—")} → after: {String(f.after ?? "—")}
        </p>
      ) : null}
    </div>
  );
}
