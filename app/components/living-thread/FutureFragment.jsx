"use client";

// FutureFragment - a released resource the customer OWNS and must place.
// Never auto-routed. Reads the geometry's `fragments` (from the resource
// ledger): each has total / placed / unplaced monthly and a state
// (possible -> placed -> confirmed). Shown as one line per fragment, not a
// card wall.

import styles from "./living-thread.module.css";

const STATE_WORD = { possible: "not placed yet", placed: "placed (not sealed)", confirmed: "sealed" };

export function FutureFragment({ fragments = [], onPlace = null }) {
  const live = fragments.filter((f) => f.kind === "released_resource" && f.totalMonthly > 0);
  if (!live.length) return null;
  return (
    <div className={styles.rail}>
      <p className={styles.railTitle}>Released resource</p>
      <ul className={styles.railList}>
        {live.map((f) => (
          <li key={f.resourceId}>
            <strong>{f.totalMonthly}/mo</strong> freed by {f.domain} — {STATE_WORD[f.state] ?? f.state}.
            {f.placedMonthly > 0 ? ` ${f.placedMonthly}/mo placed,` : ""} {f.unplacedMonthly}/mo still yours to place.
            {onPlace && f.state !== "confirmed" ? (
              <>
                {" "}
                <button type="button" className={styles.lensBtn} onClick={() => onPlace(f)}>
                  Place it
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <p className={styles.railMuted}>FutureOS never moves this for you.</p>
    </div>
  );
}
