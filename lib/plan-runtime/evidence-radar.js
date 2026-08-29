// Evidence Radar - rank the 1-3 unknowns most worth resolving (pure).
//
// Instead of handing the customer a full form, the radar looks at a plan's
// evidence entries and surfaces only the few that would move the result the
// most or make the plan infeasible if wrong. Each answered item updates
// plan_evidence and the plan gets more certain - the app never pretends an
// unprovided fact is settled.

import { isRealEvidence, rollUpConfidence } from "./plan-model.js";

// An evidence row is "open" (worth asking about) when it is required but
// missing, or still only an estimate/market_range while carrying real
// weight, or a real quote that has expired / is about to.
export function isOpenUnknown(row, now = new Date()) {
  if (row.required && (row.value == null || row.value === "")) return true;
  if (!isRealEvidence(row.truthfulness) && row.impact_weight > 0) return true;
  if (row.valid_until && new Date(row.valid_until) <= now) return true;
  return false;
}

// Why this unknown matters, as a stable reason code the formatter turns into
// copy. Ordered by how the radar should phrase urgency.
export function reasonForUnknown(row, now = new Date()) {
  if (row.required && (row.value == null || row.value === "")) return "blocks_feasibility";
  if (row.valid_until && new Date(row.valid_until) <= now) return "quote_expired";
  if (row.valid_until) {
    const days = Math.ceil((new Date(row.valid_until) - now) / 86400000);
    if (days <= 7) return "quote_expiring_soon";
  }
  if (row.truthfulness === "estimate" && row.impact_weight >= 60) return "biggest_budget_swing";
  if (!isRealEvidence(row.truthfulness)) return "estimate_needs_confirming";
  return "worth_reviewing";
}

// Return the top `max` open unknowns, highest impact first, each with its
// reason and (if a range is known) the swing it represents.
export function rankUnknowns(evidenceRows, { max = 3, now = new Date() } = {}) {
  return evidenceRows
    .filter((row) => isOpenUnknown(row, now))
    .sort((a, b) => {
      // required-missing always outranks weight
      const aBlock = a.required && a.value == null ? 1 : 0;
      const bBlock = b.required && b.value == null ? 1 : 0;
      if (aBlock !== bBlock) return bBlock - aBlock;
      return (b.impact_weight ?? 0) - (a.impact_weight ?? 0);
    })
    .slice(0, max)
    .map((row) => ({
      field: row.field,
      label: row.label || row.field,
      truthfulness: row.truthfulness,
      reason: reasonForUnknown(row, now),
      impactWeight: row.impact_weight ?? 0,
      swing:
        row.range_low != null && row.range_high != null
          ? { low: Number(row.range_low), high: Number(row.range_high), spread: Math.round(Number(row.range_high) - Number(row.range_low)) }
          : null,
      validUntil: row.valid_until ?? null,
    }));
}

// Overall plan certainty from every evidence row, plus how many open
// unknowns remain - the radar's headline ("3 things left to pin down").
export function computePlanCertainty(evidenceRows, { now = new Date() } = {}) {
  const rollup = rollUpConfidence(
    evidenceRows.map((row) => ({
      field: row.field,
      truthfulness: row.truthfulness,
      required: row.required,
      value: row.value,
    })),
  );
  const open = evidenceRows.filter((row) => isOpenUnknown(row, now));
  return {
    ...rollup,
    openUnknownCount: open.length,
    settledCount: evidenceRows.length - open.length,
    totalTracked: evidenceRows.length,
  };
}
