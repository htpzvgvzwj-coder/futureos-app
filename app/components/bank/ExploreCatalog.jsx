"use client";

// The always-visible Explore capability directory (Future Bank, Part 6 /
// Usable RC, section 八). A clean VERTICAL list under section headings -
// no grid, no card wall, no hidden <details>. Every row: name, the problem
// it solves, what it reads, the CURRENT capability status (from
// /api/capabilities), and one CTA. No dead buttons - a non-actionable row
// says why and what is required.

import styles from "./bank.module.css";
import { EXPLORE_GROUPS } from "./explore-catalog.js";

const STATUS_PILL = {
  live: styles.pillLive,
  limited: styles.pillLimited,
  connection_required: styles.pillBlocked,
  unavailable: styles.pillBlocked,
  restricted_by_age: styles.pillBlocked,
  restricted_by_permission: styles.pillBlocked,
};
const STATUS_LABEL = {
  live: "Live",
  limited: "Limited",
  connection_required: "Connection required",
  unavailable: "Unavailable",
  restricted_by_age: "Age-restricted",
  restricted_by_permission: "Permission needed",
};

export function ExploreCatalog({ onOpen, activeDomains = [], capabilities = null, t = null }) {
  const active = new Set(activeDomains);
  const caps = capabilities?.capabilities ?? capabilities ?? {};
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
              const cap = caps[e.id] ?? null;
              const status = cap?.status ?? "live";
              const actionable = cap ? cap.actionable : true;
              return (
                <li key={e.id} className={styles.catalogRow}>
                  <button
                    type="button"
                    className={styles.catalogRowBtn}
                    onClick={() => onOpen?.(e.cta, e)}
                    aria-describedby={cap && !actionable ? `cap-${e.id}` : undefined}
                  >
                    <span className={styles.catalogRowHead}>
                      <span className={styles.catalogName}>{label(`explore.catalog.entry.${e.id}.name`, e.name)}</span>
                      {cap ? <span className={`${styles.pill} ${STATUS_PILL[status] ?? ""}`}>{STATUS_LABEL[status] ?? status}</span> : null}
                      {isActive ? <span className={styles.catalogBadge}>{label("explore.catalog.inProgress", "In progress")}</span> : null}
                    </span>
                    <span className={styles.catalogProblem}>{label(`explore.catalog.entry.${e.id}.problem`, e.problem)}</span>
                    <span className={styles.catalogResult}>{label(`explore.catalog.entry.${e.id}.result`, e.result)}</span>
                    <span className={styles.catalogMeta}>
                      {label("explore.catalog.reads", "Reads")}: {e.reads.length ? e.reads.join(", ") : label("explore.catalog.readsNothing", "nothing yet")}
                    </span>
                    {cap && !actionable ? (
                      <span id={`cap-${e.id}`} className={styles.fieldError}>
                        {cap.whatIsRequired ?? cap.note ?? "Not available yet."}
                      </span>
                    ) : (
                      <span className={styles.catalogCta}>{label(`explore.catalog.entry.${e.id}.cta`, `Open ${e.name}`)} →</span>
                    )}
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
