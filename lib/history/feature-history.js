// Per-feature usage history — "what you've done here", merged from the two
// real records the app already keeps: the Change Ledger (actions with a
// money/plan impact) and the audit trail (settings, roles, consent). One
// normalised, newest-first list per feature. No new storage.

import { query } from "../db.js";

const FEATURES = {
  today: {
    ledger: ["mirror", "money_moments"],
    audit: ["money_moment_reviewed", "money_moment_acknowledged", "money_moment_snoozed"],
  },
  spending: { ledger: ["mirror"], audit: [] },
  twin: {
    ledger: ["home", "wedding", "retirement", "loan", "investment", "travel", "family", "quote_to_plan", "emergency"],
    audit: [],
  },
  explore: {
    ledger: ["home", "wedding", "retirement", "loan", "investment", "travel", "family", "emergency"],
    audit: ["sample_data_loaded", "sample_data_cleared"],
  },
  connections: { ledger: [], audit: ["provider_connected", "provider_disconnected"] },

  // Money Rescue — the recovery actions you actually adopted (a plan
  // pause / reduce, a drawdown, an invest-excess, other OCBC support).
  // Scoped by action_type so the Emergency Studio's own seals don't leak
  // in.
  money_rescue: {
    ledger: ["emergency"],
    ledgerActionTypes: ["rescue_adopted"],
    audit: [],
  },

  // Protect & Handoff — a protection plan you sealed (the insurance
  // Studio) + the written financial-handoff plan (from Family & Care).
  protect_handoff: {
    ledger: ["insurance"],
    audit: ["handoff_plan_described"],
  },
  family: {
    ledger: [],
    audit: [
      "role_granted", "role_updated", "role_revoked", "handoff_plan_described",
      "care_invite_created", "care_invite_accepted", "care_link_revoked",
      "care_shared_range_set", "care_transition_applied", "care_transition_dismissed",
      "authorization_allowance_set", "authorization_policy_changed", "care_nudge_sent",
    ],
  },
  guardian: {
    ledger: ["guardian", "money_moments"],
    audit: [
      "guardian_contract_changed", "guardian_contract_reset",
      "authorization_approved", "authorization_declined", "authorization_executed",
      "authorization_owner_confirmed", "account_frozen", "account_unfrozen",
      "care_decided_approved", "care_decided_declined", "care_view_read",
      "guardian_collision_path_applied", "guardian_recovery_step_applied", "guardian_recovery_step_ack",
    ],
  },

  // Guardian's sub-sections — each keeps its own scoped record so the
  // history sits with the thing it belongs to, not only at the page foot.
  "guardian:contract": {
    ledger: [],
    audit: ["guardian_contract_changed", "guardian_contract_reset"],
  },
  "guardian:approvals": {
    ledger: [],
    audit: [
      "authorization_approved", "authorization_declined", "authorization_executed",
      "authorization_owner_confirmed", "account_frozen", "account_unfrozen",
    ],
  },
  "guardian:collision": {
    ledger: ["guardian"],
    ledgerActionTypes: ["plan_updated"],
    audit: ["guardian_collision_path_applied"],
  },
  "guardian:recovery": {
    ledger: ["guardian"],
    ledgerActionTypes: ["commitment_paused"],
    audit: ["guardian_recovery_step_applied", "guardian_recovery_step_ack"],
  },
  // Everything Guardian did to your plans / cashflow — feeds the Promise
  // Shield's record (its buckets move whenever Guardian pauses or resizes
  // a commitment).
  "guardian:moves": {
    ledger: ["guardian"],
    ledgerActionTypes: ["plan_updated", "commitment_paused", "guardian_action"],
    audit: ["guardian_collision_path_applied", "guardian_recovery_step_applied", "guardian_recovery_step_ack"],
  },
  "guardian:supervised": {
    ledger: [],
    audit: ["care_decided_approved", "care_decided_declined", "care_view_read"],
  },
};

export const HISTORY_FEATURES = Object.keys(FEATURES);

const humanize = (s) => String(s || "").replace(/[_:]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function ledgerLine(ev) {
  const impact = Array.isArray(ev.impact_set) ? ev.impact_set : [];
  const first = impact.find((e) => e.before != null && e.after != null);
  const detail = first
    ? `${humanize(first.metric)}: ${first.before} → ${first.after}`
    : ev.uncertainty_note || (ev.cause?.trigger ? humanize(ev.cause.trigger) : null);
  return { when: ev.occurred_at, what: humanize(ev.action_type), detail, actor: ev.actor, kind: "ledger" };
}

function auditLine(ev) {
  const d = ev.detail || {};
  let detail = null;
  if (d.role) detail = humanize(d.role) + (d.scope ? ` · ${d.scope}` : "");
  else if (d.capability) detail = `${humanize(d.capability)} → ${d.level}`;
  else if (d.category) detail = `${humanize(d.category)}${d.low != null ? ` ${d.low}–${d.high}` : ""}`;
  else if (d.milestone) detail = humanize(d.milestone);
  else if (d.weekly != null) detail = `SGD ${d.weekly}/week`;
  else if (d.note) detail = String(d.note).slice(0, 80);
  return { when: ev.created_at, what: humanize(ev.kind), detail, actor: ev.actor_key ? "guardian" : "you", kind: "audit" };
}

export async function buildFeatureHistory(profileKey, feature, { limit = 15 } = {}) {
  const cfg = FEATURES[feature];
  if (!cfg) return [];
  const out = [];

  if (cfg.ledger.length) {
    const params = [profileKey, cfg.ledger];
    let actionTypeClause = "";
    if (cfg.ledgerActionTypes?.length) {
      params.push(cfg.ledgerActionTypes);
      actionTypeClause = ` and action_type = any($${params.length})`;
    }
    const r = await query(
      `select occurred_at, actor, action_type, impact_set, uncertainty_note, cause
         from change_ledger_events
        where profile_key = $1 and visibility <> 'system' and source_feature = any($2)${actionTypeClause}
        order by occurred_at desc limit 40`,
      params,
    );
    out.push(...r.rows.map(ledgerLine));
  }
  if (cfg.audit.length) {
    const r = await query(
      `select created_at, actor_key, kind, detail from audit_events
        where profile_key = $1 and kind = any($2)
        order by created_at desc limit 40`,
      [profileKey, cfg.audit],
    );
    out.push(...r.rows.map(auditLine));
  }

  return out
    .filter((x) => x.when)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, limit);
}
