// Change Ledger - pure event vocabulary + shape rules (no DB/AI).
//
// The Change Ledger is FutureOS's central explanation layer: every
// meaningful action becomes ONE causal record -
//
//   cause / evidence
//     -> the decision the user or Guardian made
//     -> the change that happened immediately
//     -> the other goals it affected
//     -> the real outcome later
//
// This module owns the closed vocabularies and the validator. The store
// (lib/change-ledger/store.js) writes; the formatter (lib/change-ledger/
// format.js) renders. Numbers in cause/before/after/impact_set are always
// produced by a real calculation in the calling route, never here and never
// by a model.

export const ACTORS = ["user", "guardian", "system", "partner"];

export const SOURCE_FEATURES = [
  "wedding",
  "home",
  "mirror",
  "life_graph",
  "guardian",
  "quote_to_plan",
  "emergency",
  "investment",
  "retirement",
  "loan",
  "insurance",
  "travel",
  "family",
  "other", // custom savings goals (the "other" planner domain)
];

// Truthfulness ladder - the UI must always show which rung a record is on.
// projected < simulated < scheduled are NOT actual; active/paused/revoked/
// completed/observed describe things that really happened.
export const STATUSES = [
  "projected", // user hasn't confirmed yet - what MIGHT happen
  "simulated", // Shadow Guardian dry-run - what WOULD happen if it ran
  "scheduled", // committed, but no real bank action executed yet
  "active", // real, currently executing
  "paused", // real, currently held (e.g. Guardian pause)
  "revoked", // real, cancelled - the original change no longer applies
  "completed", // real, finished
  "observed", // a real outcome measured against an earlier prediction
];

export const VISIBILITIES = ["private", "shared", "system"];

// Stable action-type slugs. Grouped by the lifecycle in the brief. Add new
// slugs here and a matching formatter entry in format.js - never inline copy
// in a page.
export const ACTION_TYPES = {
  // Goal / plan
  GOAL_CREATED: "goal_created",
  PLAN_UPDATED: "plan_updated",
  // Future branch (Mirror)
  BRANCH_CREATED: "branch_created",
  BRANCH_COMPARED: "branch_compared",
  BRANCH_MERGED: "branch_merged",
  BRANCH_DELETED: "branch_deleted",
  BRANCH_SEALED: "branch_sealed",
  // Constraints / pins
  PIN_SET: "pin_set",
  PIN_CHANGED: "pin_changed",
  PIN_RELEASED: "pin_released",
  // Quote-to-Plan
  QUOTE_IMPORTED: "quote_imported",
  ESTIMATE_BECAME_QUOTE: "estimate_became_quote",
  QUOTE_CONFIRMED: "quote_confirmed",
  PAYMENT_MADE: "payment_made",
  // Shadow Guardian
  SHADOW_STARTED: "shadow_started",
  SHADOW_FINDING: "shadow_finding",
  SHADOW_ENDED: "shadow_ended",
  // Commitments
  COMMITMENT_CREATED: "commitment_created",
  COMMITMENT_PAUSED: "commitment_paused",
  COMMITMENT_RESUMED: "commitment_resumed",
  COMMITMENT_REVOKED: "commitment_revoked",
  // Guardian policy / actions
  GUARDIAN_POLICY_CHANGED: "guardian_policy_changed",
  GUARDIAN_ACTION: "guardian_action",
  // Money views
  PLAN_SAFE_BALANCE_CHANGED: "plan_safe_balance_changed",
  FUTURE_DIVIDEND_ALLOCATED: "future_dividend_allocated",
  // Stress / rescue
  BREAKPOINT_THRESHOLD_SET: "breakpoint_threshold_set",
  RESCUE_ADOPTED: "rescue_adopted",
  // Reality catching up
  REALITY_CHECKIN_APPLIED: "reality_checkin_applied",
  // Completion
  GOAL_COMPLETED: "goal_completed",
  PLAN_HANDOVER: "plan_handover",
  // Joint / shared goals
  JOINT_CONFIRMED: "joint_confirmed",
  JOINT_DECLINED: "joint_declined",
  JOINT_MODIFIED: "joint_modified",
};

const ACTION_TYPE_VALUES = new Set(Object.values(ACTION_TYPES));

// Statuses that must never be written for a change that has not really
// happened yet. A caller passing status "active"/"completed" for something
// that is only projected is a bug the validator catches.
export const NON_ACTUAL_STATUSES = new Set(["projected", "simulated", "scheduled"]);

export function isActualStatus(status) {
  return STATUSES.includes(status) && !NON_ACTUAL_STATUSES.has(status);
}

// One entry of impact_set: a single real before/after on one metric of one
// goal. `before`/`after` may be null when honestly unknown - paired with an
// uncertainty_note on the event.
export function buildImpact({ goalId, metric, before, after, unit = null, direction = null }) {
  const b = before == null ? null : Number(before);
  const a = after == null ? null : Number(after);
  const delta = b != null && a != null ? Math.round((a - b) * 100) / 100 : null;
  return {
    goalId,
    metric,
    before: b,
    after: a,
    delta,
    unit,
    direction: direction ?? (delta == null ? null : delta === 0 ? "flat" : delta > 0 ? "up" : "down"),
  };
}

// Deterministic idempotency key. Same logical event from a retry/double
// submit -> same key -> the store's unique index rejects the duplicate.
export function makeDedupeKey(parts) {
  return parts
    .map((p) => (p == null ? "" : String(p)))
    .join(":")
    .slice(0, 200);
}

// Validate an event draft before it is written. Returns { ok, errors }.
// Deliberately strict: the Change Ledger is only trustworthy if malformed or
// mislabelled events can't get in.
export function validateEventDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== "object") return { ok: false, errors: ["draft_not_object"] };

  if (!draft.profileKey) errors.push("missing_profileKey");
  if (!ACTORS.includes(draft.actor)) errors.push("invalid_actor");
  if (!SOURCE_FEATURES.includes(draft.sourceFeature)) errors.push("invalid_source_feature");
  if (!ACTION_TYPE_VALUES.has(draft.actionType)) errors.push("invalid_action_type");
  if (!STATUSES.includes(draft.status)) errors.push("invalid_status");
  if (draft.visibility && !VISIBILITIES.includes(draft.visibility)) errors.push("invalid_visibility");
  if (!draft.messageKey) errors.push("missing_message_key");

  if (draft.impactSet != null) {
    if (!Array.isArray(draft.impactSet)) {
      errors.push("impact_set_not_array");
    } else {
      draft.impactSet.forEach((entry, i) => {
        if (!entry || !entry.goalId || !entry.metric) errors.push(`impact_${i}_incomplete`);
      });
    }
  }

  // An event with no quantified impact and no honest reason why is not
  // acceptable - the brief forbids "plan updated" with nothing behind it.
  const hasQuantifiedImpact =
    Array.isArray(draft.impactSet) && draft.impactSet.some((e) => e && (e.before != null || e.after != null));
  if (!hasQuantifiedImpact && !draft.uncertaintyNote) {
    errors.push("impact_or_uncertainty_note_required");
  }

  return { ok: errors.length === 0, errors };
}

// Fields that must never appear in a SHARED snapshot/cause/impact (Blind
// Merge, joint Wedding/Home/Family). A shared ledger row shows only the
// jointly-agreed impact, never the other party's raw finances.
const SHARED_FORBIDDEN_KEYS = new Set([
  "accountBalance",
  "currentSavings",
  "availableLiquidSavings",
  "monthlyIncome",
  "statedMonthlyIncome",
  "salary",
  "transactions",
  "planSafeBalance",
  "privateContribution",
  "privateCeiling",
  "privatePins",
]);

// Recursively strip forbidden keys from an object destined for a shared
// event. Non-shared (private) events are stored as-is.
export function redactForShared(value) {
  if (Array.isArray(value)) return value.map(redactForShared);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SHARED_FORBIDDEN_KEYS.has(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactForShared(v);
      }
    }
    return out;
  }
  return value;
}
