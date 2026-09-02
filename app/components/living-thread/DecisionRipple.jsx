"use client";

// DecisionRipple - the animated (or static) arcs that show one decision
// travelling from the Studio it started in to every goal it moves.
//
// Every arc's shape, colour and animation SPEED come from the real
// aggregated impactSet (thread-geometry's `ripples`): magnitude drives
// `speedMs`, `state` drives solid / dotted / dashed, `direction` +
// `favourable` drive nothing decorative beyond a title. Nothing here is
// hardcoded. Under reduced motion the travelling pulse is removed and the
// tagged stroke + <title> carry the meaning.

import styles from "./living-thread.module.css";

const strokeClass = {
  confirmed: styles.rippleConfirmed,
  placed: styles.ripplePlaced,
  possible: styles.ripplePossible,
  conflict: styles.rippleConflict,
};

export function DecisionRipple({ ripples = [], reducedMotion = false }) {
  if (!ripples.length) return null;
  return (
    <g aria-hidden="true">
      {ripples.map((r) => {
        const title =
          r.state === "conflict"
            ? `${r.from} → ${r.to}: baseline conflict`
            : `${r.from} → ${r.to}: ${r.direction}${r.magnitude != null ? ` ${r.magnitude} ${r.unit ?? ""}` : ""} (${r.state})`;
        return (
          <g key={r.id}>
            <path className={`${styles.ripple} ${strokeClass[r.state] ?? styles.ripplePossible}`} d={r.arc}>
              <title>{title}</title>
            </path>
            {!reducedMotion && r.state !== "conflict" && r.speedMs > 0 ? (
              <path
                className={styles.rippleFlow}
                d={r.arc}
                style={{ animationDuration: `${r.speedMs}ms` }}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
