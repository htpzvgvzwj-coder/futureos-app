"use client";

// ThreadAccessibleView - the SAME geometry, as structured text. It takes
// the computed geometry object (nodes, ripples, conflicts, fragments) and
// renders a <dl> / <ul>. It runs NO calculation of its own - if it and the
// SVG ever disagree, that is a bug in one renderer, not two engines.

import styles from "./living-thread.module.css";

const STATE_TEXT = {
  solid: "confirmed",
  placed: "placed (not sealed)",
  ghost: "exploring",
  known: "known",
  waiting: "waiting on you",
  unknown: "unknown",
  conflict: "in conflict",
};

export function ThreadAccessibleView({ geometry, lens }) {
  if (!geometry) return null;
  const { nodes = [], ripples = [], conflicts = [], fragments = [] } = geometry;
  return (
    <div className={styles.a11y}>
      <p>
        Living Thread — {lens} lens. One continuous life line; switching lens changes only what is shown, never the numbers. Snapshot {geometry.snapshotId ?? "—"}.
      </p>
      <dl>
        <dt>Life nodes (left to right)</dt>
        {nodes.map((n) => (
          <dd key={n.id}>
            {n.label}: {STATE_TEXT[n.state] ?? n.state}
            {n.value != null ? ` (${n.value})` : ""}
            {n.enterable ? ` — enter the ${n.domain} studio` : ""}
          </dd>
        ))}
        {ripples.length ? <dt>What each open decision is moving</dt> : null}
        {ripples.map((r) => (
          <dd key={r.id}>
            {r.fromDomain}: {r.from} → {r.to}, {r.direction}
            {r.magnitude != null ? ` by ${r.magnitude} ${r.unit ?? ""}` : ""} — {STATE_TEXT[r.state] ?? r.state}
            {r.favourable === true ? " (better)" : r.favourable === false ? " (worse)" : ""}
          </dd>
        ))}
        {fragments.length ? <dt>Released resources</dt> : null}
        {fragments
          .filter((f) => f.totalMonthly > 0)
          .map((f) => (
            <dd key={f.resourceId}>
              {f.totalMonthly}/mo from {f.domain}: {f.placedMonthly}/mo placed, {f.unplacedMonthly}/mo still to place ({f.state}).
            </dd>
          ))}
        {conflicts.length ? <dt>Conflicts</dt> : null}
        {conflicts.map((c, idx) => (
          <dd key={idx}>
            {c.kind === "baseline"
              ? `Baseline conflict on ${c.targetGoalId} (${c.metric}): ${c.reason}. No combined number is shown.`
              : `${c.domain}: ${c.reason}. That plan drives nothing until resolved.`}
          </dd>
        ))}
      </dl>
    </div>
  );
}
