// Change Ledger - event formatter (pure, no DB/AI).
//
// One extensible registry keyed by action_type. A page never builds ledger
// copy itself - it calls formatEvent(event, t) and renders the result. Every
// message_key here must have a matching entry in locales/en.json AND
// locales/zh.json under "changeLedger.*".
//
// formatEvent returns:
//   {
//     headline,          // one-line "what happened"
//     detail,            // optional second line
//     impactLines,       // [{ text, direction }] - the 1-3 biggest effects
//     statusLabel,       // truthfulness rung, human-readable
//     isActual,          // false for projected/simulated/scheduled
//     truthfulnessKey,   // raw status for styling
//   }

import { isActualStatus } from "./events.js";

// A producer is pure and has no translator, so a message param that must
// itself be a localized label is passed as the sentinel "$t:<key>". Resolve
// those against t before interpolation. A bare domain/goal key ("home") is
// title-cased so it reads right mid-sentence ("a Home savings plan") and,
// via the Future Bank dictionary, resolves to its label ("购房").
const LABELLED = new Set(["domain", "goal", "goalId"]);
const titleCase = (s) => String(s).replace(/^\w/, (c) => c.toUpperCase());
function resolveParams(t, params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.startsWith("$t:")) out[k] = t(v.slice(3));
    else if (LABELLED.has(k) && typeof v === "string" && /^[a-z][a-z_]*$/.test(v)) out[k] = titleCase(v);
    else out[k] = v;
  }
  return out;
}

function fmtMonthDelta(t, delta) {
  if (delta == null) return null;
  const abs = Math.abs(delta);
  if (delta === 0) return t("changeLedger.impact.dateUnchanged");
  return delta > 0
    ? t("changeLedger.impact.dateLater", { months: abs })
    : t("changeLedger.impact.dateEarlier", { months: abs });
}

function fmtMoneyDelta(t, entry) {
  if (entry.before == null || entry.after == null) return null;
  return t("changeLedger.impact.monthlyChange", {
    metric: t(`changeLedger.metric.${entry.metric}`),
    before: entry.before,
    after: entry.after,
  });
}

// metric -> how to phrase its impact line. Falls back to a generic
// before/after. direction is carried through for the caller's styling.
function impactLine(t, entry) {
  let text;
  if (entry.unit === "months" && entry.metric === "targetDate") {
    text = fmtMonthDelta(t, entry.delta);
  } else if (entry.unit === "sgd_per_month") {
    text = fmtMoneyDelta(t, entry);
  } else if (entry.unit === "months" && entry.metric === "emergencyBuffer") {
    text =
      entry.before != null && entry.after != null
        ? t("changeLedger.impact.bufferChange", { before: entry.before, after: entry.after })
        : null;
  } else if (entry.unit === "score" && entry.before != null && entry.after != null) {
    text = t("changeLedger.impact.scoreChange", {
      goal: entry.goalId,
      before: entry.before,
      after: entry.after,
    });
  } else if (entry.unit === "sgd" && entry.before != null && entry.after != null) {
    text = t("changeLedger.impact.budgetChange", {
      metric: t(`changeLedger.metric.${entry.metric}`),
      before: entry.before,
      after: entry.after,
    });
  } else if (entry.before != null && entry.after != null) {
    text = t("changeLedger.impact.genericChange", {
      metric: t(`changeLedger.metric.${entry.metric}`),
      before: entry.before,
      after: entry.after,
    });
  } else {
    text = null;
  }
  return text ? { text, direction: entry.direction, goalId: entry.goalId, metric: entry.metric } : null;
}

// action_type -> (event, t) => { headline, detail }. Keep these to real
// facts already on the event; never invent numbers here.
const HEADLINE_BUILDERS = {
  commitment_created: (e, t) => ({
    headline: t("changeLedger.event.commitment_created.headline", {
      amount: Number(e.after_snapshot?.monthlyContribution ?? e.message_params?.amount ?? 0),
      month: e.after_snapshot?.effectiveMonth ?? e.message_params?.month ?? "",
    }),
    detail: t("changeLedger.event.commitment_created.detail", {
      before: Number(e.before_snapshot?.monthlyContribution ?? 0),
      after: Number(e.after_snapshot?.monthlyContribution ?? 0),
    }),
  }),
  commitment_revoked: (e, t) => ({
    headline: t("changeLedger.event.commitment_revoked.headline"),
    detail: t("changeLedger.event.commitment_revoked.detail", {
      restored: Number(e.after_snapshot?.monthlyContribution ?? 0),
    }),
  }),
  commitment_paused: (e, t) => ({
    headline: t("changeLedger.event.commitment_paused.headline"),
    detail: t("changeLedger.event.commitment_paused.detail", {
      threshold: Number(e.cause?.emergencyFloorMonths ?? 0),
      current: Number(e.cause?.emergencyBufferMonths ?? 0),
    }),
  }),
  commitment_resumed: (e, t) => ({
    headline: t("changeLedger.event.commitment_resumed.headline"),
    detail: null,
  }),
};

// The headline as a { key, params } pair — for callers (e.g. Money Moments)
// that want to defer translation to their own render layer rather than
// resolve it here. `t` only resolves "$t:<key>" param sentinels.
const HEADLINE_KEY = {
  commitment_created: (e) => ({
    key: "changeLedger.event.commitment_created.headline",
    params: {
      amount: Number(e.after_snapshot?.monthlyContribution ?? e.message_params?.amount ?? 0),
      month: e.after_snapshot?.effectiveMonth ?? e.message_params?.month ?? "",
    },
  }),
  commitment_revoked: () => ({ key: "changeLedger.event.commitment_revoked.headline", params: {} }),
  commitment_paused: () => ({ key: "changeLedger.event.commitment_paused.headline", params: {} }),
  commitment_resumed: () => ({ key: "changeLedger.event.commitment_resumed.headline", params: {} }),
};
export function eventMessage(event, t = (k) => k) {
  if (!event) return null;
  const b = HEADLINE_KEY[event.action_type];
  if (b) return b(event);
  return { key: event.message_key, params: resolveParams(t, event.message_params ?? {}) };
}

export function formatEvent(event, t) {
  if (!event) return null;

  const builder = HEADLINE_BUILDERS[event.action_type];
  const base = builder
    ? builder(event, t)
    : {
        // Unknown/not-yet-templated type: fall back to the stored message_key
        // rather than a lie. Still honest, just less polished.
        headline: t(event.message_key, resolveParams(t, event.message_params ?? {})),
        detail: null,
      };

  const impactSet = Array.isArray(event.impact_set) ? event.impact_set : [];
  const impactLines = impactSet
    .map((entry) => impactLine(t, entry))
    .filter(Boolean)
    .slice(0, 3);

  return {
    headline: base.headline,
    detail: base.detail || null,
    impactLines,
    uncertaintyNote: event.uncertainty_note || null,
    statusLabel: t(`changeLedger.status.${event.status}`),
    isActual: isActualStatus(event.status),
    truthfulnessKey: event.status,
    actor: event.actor,
    sourceFeature: event.source_feature,
    occurredAt: event.occurred_at,
    supersededByThis: event.supersedes_event_id || null,
  };
}

// Compact receipt for the "right after an action" moment - headline + top
// impact + truthfulness only.
export function formatImpactReceipt(event, t) {
  const full = formatEvent(event, t);
  if (!full) return null;
  return {
    headline: full.headline,
    topImpacts: full.impactLines.slice(0, 3),
    statusLabel: full.statusLabel,
    isActual: full.isActual,
    truthfulnessKey: full.truthfulnessKey,
    uncertaintyNote: full.uncertaintyNote,
  };
}
