"use client";

// GuardianRail - the Watch Lens content. What Guardian watches, what would
// trigger it, what it can NEVER do, when it next checks, and a stand-down
// control. NOT a chatbot: no free-text, no conversation.
//
// The "cannot" list is fixed policy (08_Guardian_Operating_Principles):
// Guardian never moves money, never cancels a subscription, never blocks a
// payment, never changes a goal, and never uses shaming language.

import styles from "./living-thread.module.css";

const CANNOT = [
  "move money",
  "cancel a subscription or bill",
  "block or delay a payment",
  "change a goal or a plan",
  "use shaming or pressuring language",
];

export function GuardianRail({ guardian = null, watches = [], triggers = [], onStandDown = null }) {
  const needs = Boolean(guardian?.needsDecision);
  return (
    <div className={styles.rail} data-testid="lt-guardian-rail">
      <p className={styles.railTitle}>Guardian — Watch</p>
      <p className={styles.railMuted}>
        {needs ? `Waiting on your decision${guardian?.reason ? `: ${guardian.reason}` : ""}.` : "Watching. Nothing needs you right now."}
      </p>

      <p className={styles.railTitle}>Watching</p>
      <ul className={styles.railList}>
        {(watches.length ? watches : ["your emergency buffer floor", "each sealed plan's monthly pressure", "any plan that would push another below its Pin"]).map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>

      <p className={styles.railTitle}>Would flag if</p>
      <ul className={styles.railList}>
        {(triggers.length ? triggers : ["a Pin would be crossed", "committed monthly rises past your set ceiling", "a sealed plan's assumption stops holding"]).map((tr) => (
          <li key={tr}>{tr}</li>
        ))}
      </ul>

      <p className={styles.railTitle}>Can never</p>
      <ul className={`${styles.railList} ${styles.cannotList}`}>
        {CANNOT.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <p className={styles.railMuted}>Next check: {guardian?.nextCheck ? new Date(guardian.nextCheck).toLocaleDateString() : "on your next change"}.</p>
      {onStandDown ? (
        <button type="button" className={styles.lensBtn} onClick={onStandDown}>
          Stand down for now
        </button>
      ) : null}
    </div>
  );
}
