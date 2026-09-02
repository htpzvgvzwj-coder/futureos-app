// Recording helpers - turn real events into persistent ripple_events.
// Every meaningful change goes through here so the Current Ripple is
// rebuilt from the DB, never assembled from page-local state.
//
// Small ordinary transactions do NOT create a full ripple - they get a
// lightweight "future effect" flag only (see isLightweightTransaction).

import { recordRippleEvent, confirmDomainRipple, revokeDomainRipple, setRippleState } from "./store.js";

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// A Studio branch change / active-branch move -> a `possible` ripple.
export async function recordStudioImpactRipple(profileKey, { domain, cause, monthlyDelta = null, affectedGoals = [], snapshotId = null, severity = "turning_point" }) {
  if (!domain || !cause) return null;
  return recordRippleEvent(profileKey, {
    kind: "studio_impact",
    domain,
    cause,
    monthlyDelta,
    affectedGoals,
    state: "possible",
    severity,
    dedupeKey: `studio_impact:${domain}`,
    snapshotId,
    sourceRef: { kind: "studio_branch", domain },
  });
}

// Seal -> the domain's `possible` ripple becomes `confirmed`.
export async function recordSealRipple(profileKey, domain, { snapshotId = null } = {}) {
  const rows = await confirmDomainRipple(profileKey, domain, { snapshotId });
  return rows;
}

// Revoke -> the domain's ripple goes to `revoked`.
export async function recordRevokeRipple(profileKey, domain) {
  return revokeDomainRipple(profileKey, domain);
}

// A subset of transactions is worth a ripple: failures, reversals,
// large/unusual spend, salary landing, a recurring-payment change. Small
// day-to-day spend returns null here (lightweight only).
export function isLightweightTransaction(txn, { medianSpend = 0 } = {}) {
  if (!txn) return true;
  if (txn.status === "failed" || txn.status === "reversed") return false;
  if (txn.channel === "salary" && txn.direction === "credit") return false;
  if (txn.direction === "debit" && money(txn.amount) >= Math.max(500, medianSpend * 4)) return false;
  return true;
}

export async function recordTransactionRipple(profileKey, txn, { medianSpend = 0 } = {}) {
  if (isLightweightTransaction(txn, { medianSpend })) return null;
  const amt = money(txn.amount);
  let cause;
  let severity = "information";
  if (txn.status === "failed") {
    cause = `A ${txn.channel ?? "payment"} of SGD ${amt} did not go through`;
    severity = "action_required";
  } else if (txn.status === "reversed") {
    cause = `A payment of SGD ${amt} was reversed`;
  } else if (txn.channel === "salary") {
    cause = `Salary of SGD ${amt} received`;
  } else {
    cause = `A larger-than-usual payment of SGD ${amt}${txn.merchant ? ` to ${txn.merchant}` : ""}`;
  }
  return recordRippleEvent(profileKey, {
    kind: "transaction_change",
    domain: null,
    cause,
    monthlyDelta: null,
    affectedGoals: [],
    state: "confirmed",
    severity,
    dedupeKey: `transaction_change:${txn.id}`,
    sourceRef: { kind: "transaction", transactionId: txn.id },
  });
}

export { setRippleState };
