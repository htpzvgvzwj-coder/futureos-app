"use client";

// The always-visible Explore capability directory (Future Bank, Part 6).
// A clean VERTICAL list under section headings - no grid, no card wall,
// no hidden <details>. Every row: name, the problem it solves, what it
// reads, what it produces, current state, one CTA.

import styles from "./bank.module.css";
import { EXPLORE_GROUPS } from "./explore-catalog.js";

export function ExploreCatalog({ onOpen, activeDomains = [], t = null }) {
  const active = new Set(activeDomains);
  const label = (key, fallback) => (t ? t(key) : fallback);

  return (
    <div className={styles.catalog} aria-label={label("explore.allAreas", "Everything you can do here")}>
      {EXPLORE_GROUPS.map((group) => (
        <section key={group.id} className={styles.catalogGroup} aria-labelledby={`cat-${group.id}`}>
          <h3 id={`cat-${group.id}`} className={styles.catalogGroupTitle}>
            {label(`explore.catalog.group.${group.id}`, group.title)}
          </h3>
          <ul className={styles.catalogList}>
            {group.entries.map((e) => {
              const isActive = active.has(e.id);
              return (
                <li key={e.id} className={styles.catalogRow}>
                  <button type="button" className={styles.catalogRowBtn} onClick={() => onOpen?.(e.cta, e)}>
                    <span className={styles.catalogRowHead}>
                      <span className={styles.catalogName}>{label(`explore.catalog.entry.${e.id}.name`, e.name)}</span>
                      {isActive ? <span className={styles.catalogBadge}>{label("explore.catalog.inProgress", "In progress")}</span> : null}
                    </span>
                    <span className={styles.catalogProblem}>{label(`explore.catalog.entry.${e.id}.problem`, e.problem)}</span>
                    <span className={styles.catalogResult}>{label(`explore.catalog.entry.${e.id}.result`, e.result)}</span>
                    <span className={styles.catalogMeta}>
                      {label("explore.catalog.reads", "Reads")}: {e.reads.length ? e.reads.join(", ") : label("explore.catalog.readsNothing", "nothing yet")}
                    </span>
                    <span className={styles.catalogCta}>{label(`explore.catalog.entry.${e.id}.cta`, `Open ${e.name}`)} →</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
