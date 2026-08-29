// Plan Runtime - plan versioning + evidence/confidence rollups (pure).
//
// A plan is never mutated in place. Every real change produces a new
// immutable version that records what it superseded, why (cause), and the
// evidence it rested on - the raw material for a "Decision Receipt" the
// customer can read months later. Confidence is DERIVED from the
// truthfulness of the evidence behind the plan, never asserted.

// The truthfulness ladder for a single piece of plan evidence, weakest to
// strongest. A plan line item (venue cost, property price, ...) is tagged
// with one of these; the plan's overall confidence rolls up from them.
export const EVIDENCE_TRUTHFULNESS = ["estimate", "market_range", "real_quote", "confirmed", "paid"];

export function isRealEvidence(tag) {
  return tag === "real_quote" || tag === "confirmed" || tag === "paid";
}

export function evidenceRank(tag) {
  const i = EVIDENCE_TRUTHFULNESS.indexOf(tag);
  return i < 0 ? 0 : i;
}

// version is a simple integer string "1", "2", ... kept as text so it can
// live in a text column next to other id-like fields.
export function nextVersion(currentVersion) {
  const n = Number.parseInt(currentVersion ?? "0", 10);
  return String((Number.isFinite(n) ? n : 0) + 1);
}

// Build the next immutable plan version. `base` is the current version
// object (or null for v1). `patch` holds only the changed fields.
export function buildPlanVersion({ base = null, patch = {}, cause = {}, evidence = [], actor = "user", now = new Date() }) {
  const version = nextVersion(base?.version);
  const merged = { ...(base?.data ?? {}), ...patch };
  return {
    version,
    supersedesVersion: base?.version ?? null,
    data: merged,
    cause,
    evidence,
    actor,
    createdAt: now.toISOString(),
    ...rollUpConfidence(evidence),
  };
}

// Roll a list of evidence entries ({ field, truthfulness, ... }) up into a
// single { confidence, uncertaintyNote?, evidenceMaturityPercent }.
// - confidence "high"   : every priced field is real_quote+
// - confidence "medium" : a mix, or all market_range
// - confidence "low"    : mostly bare estimates, or key fields missing
export function rollUpConfidence(evidence = []) {
  const priced = evidence.filter((e) => e && e.truthfulness);
  if (priced.length === 0) {
    return {
      confidence: "low",
      evidenceMaturityPercent: 0,
      uncertaintyNote: "no_evidence_yet",
    };
  }
  const realCount = priced.filter((e) => isRealEvidence(e.truthfulness)).length;
  const maturity = Math.round((realCount / priced.length) * 100);
  const missingKey = evidence.some((e) => e && e.required && e.value == null);

  // "high" = the plan rests almost entirely on real quotes/confirmations;
  // "medium" = at least some real evidence is in; "low" = still essentially
  // all estimates (or a required fact is missing).
  let confidence;
  if (missingKey) confidence = "low";
  else if (maturity >= 80) confidence = "high";
  else if (maturity >= 25) confidence = "medium";
  else confidence = "low";

  return {
    confidence,
    evidenceMaturityPercent: maturity,
    uncertaintyNote: missingKey ? "key_evidence_missing" : maturity < 25 ? "mostly_estimates" : null,
  };
}

// Given the old and new version's `data`, produce a minimal diff suitable
// for a Change Ledger before/after snapshot - only fields that actually
// changed, numbers rounded.
export function diffPlanData(beforeData = {}, afterData = {}) {
  const keys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
  const before = {};
  const after = {};
  for (const key of keys) {
    const b = beforeData[key];
    const a = afterData[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    before[key] = typeof b === "number" ? Math.round(b * 100) / 100 : b ?? null;
    after[key] = typeof a === "number" ? Math.round(a * 100) / 100 : a ?? null;
  }
  return { before, after, changedKeys: Object.keys(after) };
}

// Merge two branch `data` objects field-by-field per an explicit pick map
// ({ field: "a" | "b" }) - the real operation behind Future Field's "Merge"
// (take the venue from branch A, the date from branch B).
export function mergeBranchData(dataA = {}, dataB = {}, pickMap = {}) {
  const keys = new Set([...Object.keys(dataA), ...Object.keys(dataB), ...Object.keys(pickMap)]);
  const out = {};
  for (const key of keys) {
    const pick = pickMap[key];
    if (pick === "b") out[key] = dataB[key];
    else if (pick === "a") out[key] = dataA[key];
    else out[key] = key in dataA ? dataA[key] : dataB[key]; // default: A wins
  }
  return out;
}
