"use client";

// Guardian, as a bank explaining what it is protecting (Future Bank,
// Part 9). Present BEFORE and after a Seal. One overall state (Calm /
// Watch / Decide / Urgent) plus explicit sections: Watching now / Why now
// / Trigger / Affected plan / What Guardian can do / cannot do /
// Permission / Next review, with Snooze, Pause and Revoke controls.
//
// With no real execution rail, can_move_money is false and Guardian only
// suggests, prepares and reminds. It never moves money.

import styles from "./bank.module.css";

const STATE_CLASS = {
  calm: styles.stateCalm,
  watch: styles.stateWatch,
  decide: styles.stateDecide,
  urgent: styles.stateUrgent,
};

const CANNOT = [
  "move money",
  "cancel a subscription or bill",
  "block or delay a payment",
  "change a goal or a plan on its own",
  "use shaming or pressuring language",
];

// Derive one state from the persisted ripple + rescue cases + commitments.
export function deriveGuardianState({ ripple, rescueCases = [], commitments = [] }) {
  const anyUrgent = (rescueCases ?? []).some((c) => c.kind === "payment_failed" || c.kind === "low_balance_ahead");
  const anyDecision = ripple?.events?.some((e) => e.state === "possible" || e.state === "placed");
  if (anyUrgent) return "urgent";
  if (anyDecision) return "decide";
  if ((commitments ?? []).length > 0 || (ripple?.events ?? []).some((e) => e.state === "confirmed")) return "watch";
  return "calm";
}

export function GuardianSections({ ripple, twin, onControl, onOpen }) {
  const rescueCases = twin?.rescueCases ?? [];
  const commitments = []; // filled from thread elsewhere; state derivation tolerates empty
  const state = deriveGuardianState({ ripple, rescueCases, commitments });

  const watching = [
    "your Emergency buffer floor",
    ...(twin?.balances ?? []).filter((b) => b.isLiability).map((b) => `${b.displayName || "credit card"} balance vs your liquid cash`),
    ...(ripple?.events ?? []).filter((e) => e.state === "confirmed" && e.domain).map((e) => `the ${e.domain} plan's monthly pressure`),
  ].slice(0, 5);

  const triggers = [
    "Available to Spend would fall below your protected floor",
    "a sealed plan's assumption stops holding (Reality Drift)",
    "a payment fails or a large unusual charge posts",
  ];

  const whyNow =
    state === "urgent"
      ? rescueCases[0]?.whatHappened ?? "A payment problem needs your attention."
      : state === "decide"
        ? "You have an unsealed change on the thread."
        : state === "watch"
          ? "A sealed plan is running; Guardian is checking reality against it."
          : "Nothing needs you right now.";

  return (
    <div className={styles.bank}>
      <span className={`${styles.guardianState} ${STATE_CLASS[state]}`}>{state}</span>
      <p className={styles.provenance}>{whyNow}</p>

      <div className={styles.gSection}>
        <p className={styles.gSectionTitle}>Watching now</p>
        <ul className={styles.gList}>
          {watching.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>

      <div className={styles.gSection}>
        <p className={styles.gSectionTitle}>Would flag if</p>
        <ul className={styles.gList}>
          {triggers.map((tr) => (
            <li key={tr}>{tr}</li>
          ))}
        </ul>
      </div>

      {rescueCases.length ? (
        <div className={styles.gSection}>
          <p className={styles.gSectionTitle}>Needs your decision</p>
          <ul className={styles.gList}>
            {rescueCases.slice(0, 3).map((c) => (
              <li key={c.id}>
                {c.whatHappened} <button type="button" className={styles.catalogCta} onClick={() => onOpen?.("hardship", c)}>Open Money Rescue</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.gSection}>
        <p className={styles.gSectionTitle}>What Guardian can do</p>
        <ul className={styles.gList}>
          <li>suggest a change and prepare it for your approval</li>
          <li>remind you before a turning point</li>
          <li>watch reality against your sealed plans</li>
        </ul>
      </div>

      <div className={styles.gSection}>
        <p className={styles.gSectionTitle}>What Guardian can never do</p>
        <ul className={`${styles.gList} ${styles.gCannot}`}>
          {CANNOT.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className={styles.gPerm}>Permission: can_move_money = false (no real payment rail connected).</p>
      </div>

      <div className={styles.gControls}>
        <button type="button" onClick={() => onControl?.("snooze")}>Snooze</button>
        <button type="button" onClick={() => onControl?.("pause")}>Pause</button>
        <button type="button" onClick={() => onControl?.("revoke")}>Revoke</button>
      </div>
    </div>
  );
}
