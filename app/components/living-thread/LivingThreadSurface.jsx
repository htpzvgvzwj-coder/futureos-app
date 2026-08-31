"use client";

// LivingThreadSurface - ONE continuous life-line surface with four Lenses.
//
//   Today    = Now Lens    - Bank Now, the single current moment, the last
//                            real change, one action. No 9-studio grid.
//   Life     = Life Lens    - the whole continuous line: Solid confirmed
//                            nodes, Ghost possible paths, conflicts,
//                            Studios as enterable nodes (not a menu).
//   Explore  = Branch Lens  - reality + the active branch + up to two
//                            alternatives; everything Ghost until Seal.
//   Guardian = Watch Lens   - what Guardian watches / would flag / can
//                            never do / next check / stand-down.
//
// All four Lenses read the SAME thread payload and run the SAME
// buildThreadGeometry. `lens` only selects which overlay LAYERS draw - it
// never changes a node state, a ripple magnitude, the spine or any number.

import { useEffect, useMemo, useState } from "react";
import styles from "./living-thread.module.css";
import { buildThreadGeometry } from "./thread-geometry.js";
import { DecisionRipple } from "./DecisionRipple.jsx";
import { FutureFragment } from "./FutureFragment.jsx";
import { GuardianRail } from "./GuardianRail.jsx";
import { ThreadMemoryScrubber } from "./ThreadMemoryScrubber.jsx";
import { ThreadAccessibleView } from "./ThreadAccessibleView.jsx";

export const LENSES = [
  { id: "today", label: "Today" },
  { id: "life", label: "Life" },
  { id: "explore", label: "Explore" },
  { id: "guardian", label: "Guardian" },
];

function usePrefersReducedMotion(override) {
  const [reduced, setReduced] = useState(Boolean(override));
  useEffect(() => {
    if (override != null) {
      setReduced(Boolean(override));
      return;
    }
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [override]);
  return reduced;
}

const nodeStateClass = {
  solid: styles.stateSolid,
  placed: styles.statePlaced,
  ghost: styles.stateGhost,
  known: styles.stateKnown,
  waiting: styles.stateWaiting,
  unknown: styles.stateUnknown,
  conflict: styles.stateConflict,
};

export function LivingThreadSurface({
  thread,
  lens: lensProp,
  defaultLens = "life",
  onLensChange,
  onEnterStudio,
  onPlaceFragment,
  onStandDown,
  memoryEvents = [],
  reducedMotion: reducedMotionProp = null,
  width = 960,
  height = 320,
}) {
  const [lensState, setLensState] = useState(defaultLens);
  const lens = lensProp ?? lensState;
  const reducedMotion = usePrefersReducedMotion(reducedMotionProp);

  const setLens = (id) => {
    if (lensProp == null) setLensState(id);
    onLensChange?.(id);
  };

  // ONE computation. Only `layers` / `lens` differ between Lenses.
  const geometry = useMemo(
    () =>
      buildThreadGeometry({
        lifeNodes: thread?.lifeNodes ?? [],
        crossGoalEdges: thread?.crossGoalEdges ?? [],
        studioImpacts: thread?.studioImpacts ?? {},
        activeDrafts: thread?.activeDrafts ?? [],
        guardianDecision: thread?.guardianDecision ?? null,
        latestChange: thread?.latestChange ?? null,
        width,
        height,
        lens,
      }),
    [thread, lens, width, height],
  );

  if (!thread) {
    return (
      <div className={styles.surface}>
        <p className={styles.railMuted}>The Living Thread is loading.</p>
      </div>
    );
  }

  const has = (layer) => geometry.layers.includes(layer);
  const bankNow = thread.bankNow ?? null;

  return (
    <section
      className={`${styles.surface} ${reducedMotion ? styles.reducedMotion : ""}`}
      aria-label="Living Thread"
      data-lens={lens}
      data-snapshot={geometry.snapshotId ?? ""}
    >
      <div className={styles.lensBar} role="tablist" aria-label="Living Thread lens">
        {LENSES.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === lens}
            className={`${styles.lensBtn} ${l.id === lens ? styles.lensBtnActive : ""}`}
            onClick={() => setLens(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      {geometry.hasBaselineConflict ? (
        <p className={styles.conflictBanner} role="status">
          Part of the thread is in conflict — no combined number is shown for it until it is resolved.
        </p>
      ) : null}

      <div className={styles.canvasWrap}>
        <svg className={styles.canvas} viewBox={geometry.viewBox} role="img" aria-label={`Living Thread, ${lens} lens`}>
          {/* the one continuous spine, always */}
          <path className={styles.spine} d={geometry.spinePath} />

          {/* cross-goal edges (Life / Explore) */}
          {has("edges")
            ? geometry.edges.map((e, i) =>
                e.x1 == null ? null : (
                  <path
                    key={i}
                    className={`${styles.edge} ${e.impactState === "solid" ? styles.edgeSolid : ""} ${
                      e.impactState === "ghost" ? styles.edgeGhost : ""
                    } ${e.impactState === "conflict" ? styles.edgeConflict : ""}`}
                    d={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`}
                  >
                    <title>{`${e.from} → ${e.to}: ${e.direction}${e.magnitude != null ? ` ${e.magnitude} ${e.unit ?? ""}` : ""}`}</title>
                  </path>
                ),
              )
            : null}

          {/* decision ripples from the REAL impactSet */}
          {has("ripples") ? <DecisionRipple ripples={geometry.ripples} reducedMotion={reducedMotion} /> : null}

          {/* the nodes - enterable in the Life lens */}
          {geometry.nodes.map((n) => {
            const enter = has("enterStudios") && n.enterable && onEnterStudio;
            const Dot = (
              <g className={`${styles.node} ${enter ? styles.nodeEnterable : ""} ${nodeStateClass[n.state] ?? ""}`}>
                <circle className={styles.nodeDot} cx={n.x} cy={n.y} r={n.state === "unknown" ? 5 : 7} />
                <text className={styles.nodeLabel} x={n.x} y={n.y + 24}>
                  {n.label}
                </text>
              </g>
            );
            return enter ? (
              <a key={n.id} role="button" tabIndex={0} onClick={() => onEnterStudio(n.domain)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onEnterStudio(n.domain))}>
                {Dot}
              </a>
            ) : (
              <g key={n.id}>{Dot}</g>
            );
          })}

          {/* the "now" marker (Today / Guardian) */}
          {has("now") ? (
            <g className={styles.nowMarker}>
              <line x1={geometry.now.x} y1={16} x2={geometry.now.x} y2={geometry.height - 16} />
              <text x={geometry.now.x} y={12}>
                now
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      {/* --- lens-specific rails (presentation only) -------------------- */}
      {has("bankNow") && bankNow ? (
        <div className={styles.rail}>
          <p className={styles.railTitle}>Bank now</p>
          <p>
            {bankNow.known ? `${bankNow.currency ?? "SGD"} ${Math.round(bankNow.availableBalance ?? 0).toLocaleString()} available` : "Balance not linked yet."}
          </p>
          {bankNow.oneThingThisWeek ? (
            <p className={styles.railMuted}>
              One thing this week: {bankNow.oneThingThisWeek.kind} ({bankNow.oneThingThisWeek.amount}).
            </p>
          ) : null}
        </div>
      ) : null}

      {has("lastChange") && geometry.lastChange ? (
        <div className={styles.rail}>
          <p className={styles.railTitle}>Last real change</p>
          <p>
            {geometry.lastChange.label}
            {geometry.lastChange.at ? ` — ${new Date(geometry.lastChange.at).toLocaleDateString()}` : ""}
          </p>
        </div>
      ) : null}

      {has("fragmentPlacement") || has("ripples") ? (
        <FutureFragment fragments={geometry.fragments} onPlace={onPlaceFragment} />
      ) : null}

      {has("guardianWatch") ? (
        <GuardianRail guardian={geometry.guardian} onStandDown={onStandDown} />
      ) : null}

      {has("enterStudios") || has("reality") ? (
        <ThreadMemoryScrubber events={memoryEvents} lastChange={geometry.lastChange} />
      ) : null}

      {/* the SAME data, structured - never a second calc engine */}
      <ThreadAccessibleView geometry={geometry} lens={lens} />
    </section>
  );
}
