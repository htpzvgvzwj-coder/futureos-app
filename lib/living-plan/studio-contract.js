// The Shared Studio Contract (Living Thread spec, Part B).
//
// Every one of the nine flagship Studios plugs into the SAME registry and
// the SAME behaviour spine, but each supplies its own native scene, its own
// variables, its own finance engine and its own cross-goal projector. This
// module owns the shapes both sides of that contract agree on:
//
//   - the eleven contract slots a Studio registers
//   - the unified domain-API response shape
//   - the unified impactSet shape (server-owned; the client never guesses)
//   - the provenance vocabulary (Part 0.3)
//   - the one behaviour spine
//   - assertStudioComplete(): which of the 20 flagship criteria a Studio
//     actually meets right now, so the completion matrix is generated from
//     code and cannot be hand-waved.
//
// Pure: no React, no DB, no network.

// ---- the eleven contract slots (Part B) ------------------------------
export const STUDIO_CONTRACT_KEYS = [
  "realityLoader", // (userId) -> canonical reality + currentMoment (server)
  "nativeScene", // the domain-unique direct-manipulation surface (client component id)
  "branchVariables", // [{ key, kind, source, min?, max?, options? }] the customer can move
  "financeProjector", // (branchData, context) -> real domain finance math
  "crossGoalProjector", // (branchData, reality, context, allocation) -> affectedGoals
  "constraintKinds", // domain-specific Pin kinds (>= 2)
  "turningPointRules", // (thread) -> turningPoint[] for this domain
  "guardianRules", // what Guardian watches / may never do for this domain
  "replayMapper", // (ledgerEvents) -> Before/After scrub frames for this domain
  "provenanceRules", // per-field provenance classifier
  "unknownRules", // which fields stay `unknown` (never a default / never 0)
];

import { isImpactUnit, directionFor, favourableFor } from "./impact-measure.js";
import { legConfirmed } from "./allocation-legs.js";

// ---- provenance vocabulary (Part 0.3) --------------------------------
export const PROVENANCE_KINDS = ["bank_confirmed", "user_confirmed", "system_estimate", "unknown"];

export function isProvenance(p) {
  return typeof p === "string" && PROVENANCE_KINDS.includes(p);
}

// A reference estimate must state as-of / region / range - and must NEVER
// be described as a quote, an approval, a Demo or a Prototype.
export function referenceEstimate({ value, low = null, high = null, asOf, region, sourceType = "reference_rate" }) {
  if (!asOf || !region) throw new Error("referenceEstimate requires asOf and region");
  return {
    provenance: "system_estimate",
    value: value ?? null,
    range: low != null && high != null ? { low, high } : null,
    asOf,
    region,
    sourceType,
    note: `Reference estimate (${region}, as of ${asOf}). Not a quote or an approval.`,
  };
}

// ---- the one behaviour spine (shared; scenes are not) ----------------
export const BEHAVIOUR_SPINE = [
  "reality",
  "manipulate",
  "branch",
  "decision_ripple",
  "allocation",
  "turning_point",
  "seal",
  "guardian",
  "memory",
];

// ---- unified impactSet (server-owned) -------------------------------
// {
//   cause,                         // what the customer changed
//   resourceDelta,                 // { freedMonthly, addedPressureMonthly, ... } - SERVER computed
//   affectedGoals: [{ goalId, before, possibleAfter, confirmedAfter, direction, metric, confidence, provenance }],
//   allocationRequired,            // boolean - a freed / pressure amount needs the customer to place it
//   assumptions,                   // [{ text, asOf?, source?, confidence? }]
// }
// `legs` (from allocation-legs#allocationLegs) drives per-goal
// confirmedAfter: a goal is SOLID only if its own leg was funded. When
// `legs` is omitted the caller's explicit confirmedAfter is kept
// (backward compatible). `direction` is ALWAYS re-derived here from the
// delta (possibleAfter - before) - a caller-supplied direction is ignored
// (rule 2). Each affectedGoal SHOULD carry a typed `unit`.
export function buildImpactSet({
  cause,
  resourceDelta = {},
  affectedGoals = [],
  allocationRequired = false,
  assumptions = [],
  legs = null,
  effectKind = null,
  resourceId = null,
}) {
  const freedMonthly = Math.max(0, Math.round(Number(resourceDelta.freedMonthly) || 0));
  const addedPressureMonthly = Math.max(0, Math.round(Number(resourceDelta.addedPressureMonthly) || 0));
  // Default the kind from the resource movement when the caller does not
  // name it: money going OUT is direct pressure, money coming BACK is a
  // released resource, neither is informational.
  const kind =
    effectKind ??
    (addedPressureMonthly > 0 ? "direct_pressure" : freedMonthly > 0 ? "released_resource" : "informational");
  return {
    cause: cause ?? null,
    effectKind: kind,
    resourceId: resourceId ?? null,
    resourceDelta: { ...resourceDelta, freedMonthly, addedPressureMonthly },
    allocationLegs: legs ?? null,
    affectedGoals: affectedGoals.map((g) => {
      const before = g.before ?? null;
      const possibleAfter = g.possibleAfter ?? null;
      let delta = g.delta ?? null;
      if (delta == null && before != null && possibleAfter != null) delta = Number(possibleAfter) - Number(before);
      const direction = directionFor({ metric: g.metric, before, after: possibleAfter, delta, comparator: g.comparator ?? null });
      // effectState: possible (exploring) -> placed (this goal's allocation
      // leg is funded, but NOT sealed) -> confirmed (sealed). A projector
      // NEVER emits "confirmed" on its own: only the thread layer, which
      // knows the moment is sealed, promotes a placed leg to confirmed.
      const legFunded = legs ? legConfirmed(legs, g.goalId) : false;
      const explicitConfirmed = !legs && g.confirmedAfter != null && before != null;
      const effectState = explicitConfirmed ? "confirmed" : legFunded ? "placed" : "possible";
      const placedAfter = effectState === "possible" ? null : possibleAfter;
      const confirmedAfter = effectState === "confirmed" ? g.confirmedAfter : null;
      return {
        goalId: g.goalId,
        metric: g.metric ?? null,
        unit: isImpactUnit(g.unit) ? g.unit : null,
        effectKind: g.effectKind ?? kind,
        effectState,
        before,
        possibleAfter,
        delta,
        placedAfter,
        confirmedAfter,
        direction,
        favourable: favourableFor({ metric: g.metric, direction }),
        confidence: g.confidence ?? "medium",
        provenance: isProvenance(g.provenance) ? g.provenance : "system_estimate",
      };
    }),
    allocationRequired: Boolean(allocationRequired),
    assumptions: assumptions.map((a) => (typeof a === "string" ? { text: a } : a)),
  };
}

export function validateImpactSet(impactSet, { requireUnit = false } = {}) {
  const errors = [];
  if (!impactSet || typeof impactSet !== "object") return { ok: false, errors: ["impactSet missing"] };
  if (!Array.isArray(impactSet.affectedGoals)) errors.push("affectedGoals must be an array");
  for (const g of impactSet.affectedGoals ?? []) {
    if (!g.goalId) errors.push("affectedGoal without goalId");
    if (!["up", "down", "flat"].includes(g.direction)) errors.push(`bad direction for ${g.goalId}`);
    if (!isProvenance(g.provenance)) errors.push(`bad provenance for ${g.goalId}`);
    // A ghost impact is fine with only possibleAfter; a confirmed one needs confirmedAfter.
    if (g.confirmedAfter != null && g.before == null) errors.push(`${g.goalId} confirmedAfter without a before`);
    if (g.effectState != null && !["possible", "placed", "confirmed"].includes(g.effectState)) errors.push(`${g.goalId} bad effectState`);
    // A projector-level goal must not carry a Solid number before Seal.
    if (g.effectState === "placed" && g.confirmedAfter != null) errors.push(`${g.goalId} placed but already confirmed`);
    // rule 4: an impact with no typed unit cannot be trusted.
    if (requireUnit && !isImpactUnit(g.unit)) errors.push(`${g.goalId} has no typed unit`);
    // rule 2: direction must agree with the delta sign.
    if (g.delta != null && Number.isFinite(Number(g.delta))) {
      const d = Number(g.delta);
      const expected = Math.abs(d) < 1e-9 ? "flat" : d > 0 ? "up" : "down";
      if (g.direction !== expected) errors.push(`${g.goalId} direction ${g.direction} disagrees with delta ${d}`);
    }
  }
  if (typeof impactSet.allocationRequired !== "boolean") errors.push("allocationRequired must be boolean");
  return { ok: errors.length === 0, errors };
}

// ---- unified domain-API response (Part B) --------------------------
export const STUDIO_RESPONSE_KEYS = [
  "domain",
  "reality",
  "currentMoment",
  "possibleBranches",
  "selectedBranch",
  "projection",
  "impactSet",
  "futureFragment",
  "addedPressure",
  "pins",
  "sealableVerdict",
  "turningPoints",
  "guardianState",
  "provenance",
  "unknowns",
];

export function validateStudioResponse(res) {
  const missing = STUDIO_RESPONSE_KEYS.filter((k) => !(k in (res ?? {})));
  const errors = missing.map((k) => `missing key: ${k}`);
  if (res && res.impactSet != null) {
    const v = validateImpactSet(res.impactSet);
    if (!v.ok) errors.push(...v.errors.map((e) => `impactSet: ${e}`));
  }
  if (res && res.sealableVerdict != null && typeof res.sealableVerdict.sealable !== "boolean") {
    errors.push("sealableVerdict.sealable must be an explicit boolean");
  }
  return { ok: errors.length === 0, errors };
}

// ---- the 20 flagship completion criteria (Part A) ------------------
// Each is a predicate over what a Studio's registry entry + shipped modules
// actually provide. `evidence` is a small fact bag the caller assembles.
export const FLAGSHIP_CRITERIA = [
  { id: "native_scene", label: "Native scene (not a FutureFieldCanvas reskin)" },
  { id: "domain_visual", label: "Domain-unique main visual + direct manipulation" },
  { id: "not_card_grid", label: "Main visual is not a card grid / table / permanent tabs / slider row" },
  { id: "real_finance_recalc", label: "Customer change re-runs the domain finance engine" },
  { id: "server_impactset", label: "Server-owned impactSet (no client-guessed impact)" },
  { id: "two_affected_goals", label: "Shows >= 2 affected other goals" },
  { id: "ghost_vs_solid", label: "Possible impact is ghost; confirmed impact is solid" },
  { id: "future_fragment", label: "Released resource -> Future Fragment, never auto-routed to Home" },
  { id: "added_pressure_source", label: "Added pressure shows where the money comes from" },
  { id: "real_branches", label: "Create / select / compare / undo real branches" },
  { id: "two_domain_pins", label: ">= 2 domain-specific Pins" },
  { id: "seal_consent", label: "Full consent summary before Seal" },
  { id: "guardian_in_place", label: "Seal -> Guardian watch state in place" },
  { id: "guardian_no_execution", label: "Guardian never moves money or changes the plan" },
  { id: "ledger_causal_chain", label: "Change Ledger rebuilds the full causal chain" },
  { id: "memory_scrub", label: "Memory Scrubber returns Before/After state" },
  { id: "reload_restores", label: "Reload restores branch / allocation / Seal / Guardian / History" },
  { id: "mobile_a11y", label: "320/390, EN/ZH, keyboard, reduced-motion" },
  { id: "unknown_not_faked", label: "No data -> Unknown, never a fabricated profile" },
  { id: "domain_integration_test", label: ">= 1 domain-specific integration test proving real causality" },
];

// Given a registry spec and an evidence bag of what is actually shipped,
// return the per-criterion status for the completion matrix.
export function assessStudio(spec, evidence = {}) {
  const has = (k) => Boolean(evidence[k]);
  const results = FLAGSHIP_CRITERIA.map((c) => ({ id: c.id, label: c.label, met: has(c.id) }));
  const metCount = results.filter((r) => r.met).length;
  const status = metCount === FLAGSHIP_CRITERIA.length ? "complete" : metCount > 0 ? "partial" : "not done";
  return { domain: spec?.domain ?? evidence.domain ?? null, status, metCount, total: FLAGSHIP_CRITERIA.length, results };
}
