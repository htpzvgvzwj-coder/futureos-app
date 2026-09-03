// Guardian Proof — the recent, real value Guardian produced, as a causal
// replay: Finding -> Reasoning -> Impact -> Decision -> Result. Built from
// Change Ledger rows, no i18n translator needed (Guardian's own phrasing).

import { isActualStatus } from "../change-ledger/events.js";

const FEATURE_LABEL = {
  guardian: "Guardian", mirror: "Money move", home: "Home plan", wedding: "Wedding plan",
  retirement: "Retirement plan", loan: "Loan plan", investment: "Investing plan",
  travel: "Travel plan", family: "Family plan", money_moments: "Guardian",
  quote_to_plan: "A quote", emergency: "Emergency fund",
};

const DECISION = {
  user: "You decided",
  guardian: "A linked guardian decided",
  system: "Guardian handled it automatically",
  partner: "A partner confirmed",
};

const RESULT_BY_STATUS = {
  completed: "Done.",
  observed: "Measured against the earlier estimate.",
  active: "In effect now.",
  scheduled: "Scheduled — no money has moved yet.",
  paused: "Paused.",
  revoked: "Cancelled — the earlier change no longer applies.",
  projected: "Waiting for you.",
  simulated: "A dry run — nothing changed.",
};

function impactLines(impactSet) {
  return (Array.isArray(impactSet) ? impactSet : [])
    .slice(0, 3)
    .map((e) => {
      const metric = String(e.metric ?? "").replace(/([A-Z])/g, " $1").toLowerCase().trim() || "an amount";
      if (e.before != null && e.after != null && e.before !== e.after) {
        const unit = e.unit === "months" ? " months" : e.unit === "sgd_per_month" ? "/month" : "";
        return `${metric}: ${e.before}${unit} → ${e.after}${unit}`;
      }
      if (e.delta != null && e.unit === "months") {
        return e.delta === 0 ? `${metric}: unchanged` : `${metric}: ${e.delta > 0 ? "+" : ""}${e.delta} months`;
      }
      return e.possibleAfter ? `${metric}: ${e.possibleAfter}` : null;
    })
    .filter(Boolean);
}

export function buildGuardianProof(events = [], { limit = 6 } = {}) {
  return events.slice(0, limit).map((ev) => {
    const impacts = impactLines(ev.impact_set);
    return {
      id: ev.id,
      when: ev.occurred_at,
      finding: FEATURE_LABEL[ev.source_feature] ?? "A change",
      // the aggregator stores a short trigger on cause; fall back to the note
      reasoning: ev.cause?.trigger
        ? String(ev.cause.trigger).replace(/_/g, " ")
        : ev.uncertainty_note || "Detected from your real accounts, bills and plans.",
      impact: impacts.length ? impacts : ["No number changed — recorded so you can see it happened."],
      decision: DECISION[ev.actor] ?? "Recorded",
      result: RESULT_BY_STATUS[ev.status] ?? ev.status,
      isActual: isActualStatus(ev.status),
    };
  });
}
