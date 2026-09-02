// CanonicalMomentSnapshot (Living Thread - causal-spine round, Part B).
//
// ONE baseline per /api/life-thread request. Every Studio projector and
// every cross-goal aggregation reads its "before" world from this single
// object, so two projectors can never disagree on the starting point and
// then have their afters silently averaged into a pseudo-precise number.
//
// The snapshot carries:
//   - snapshotId: a stable hash of the baseline material. Every ImpactMeasure
//     is stamped with it; aggregation refuses to combine measures whose
//     snapshotId differs (baseline_mismatch).
//   - committedMonthlyTotal: every active commitment, summed once.
//   - committedExcludingDomain[domain]: the committed total with THAT
//     domain's own active commitment removed exactly once - so a Studio
//     never sees its own sealed branch as external pressure, and a sealed
//     branch is never double-counted (once in the total, once as its own
//     draft).
//
// Pure: no DB, no network. `hash` is injected so this stays dependency-free.

function round(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : 0;
}

// commitmentsByDomain: { wedding: 400, retirement: 300, ... } - the active
// monthly commitment for each domain (0 / absent when none).
export function buildCanonicalSnapshot({
  generatedAt = null,
  monthlyIncome = null,
  monthlyExpenses = null,
  emergencyBufferMonths = null,
  availableMonthlyCashflow = null,
  committedMonthlyTotal = 0,
  commitmentsByDomain = {},
  hash = null,
} = {}) {
  const total = round(committedMonthlyTotal);
  const byDomain = {};
  for (const [d, v] of Object.entries(commitmentsByDomain)) byDomain[d] = round(v);

  const committedExcludingDomain = {};
  for (const d of Object.keys(byDomain)) {
    committedExcludingDomain[d] = total - byDomain[d]; // own commitment removed ONCE
  }

  const material = {
    monthlyIncome,
    monthlyExpenses,
    emergencyBufferMonths,
    availableMonthlyCashflow,
    committedMonthlyTotal: total,
    commitmentsByDomain: byDomain,
  };
  const snapshotId =
    typeof hash === "function" ? String(hash(JSON.stringify(material))).slice(0, 16) : cheapHash(JSON.stringify(material));

  return {
    snapshotId,
    generatedAt: generatedAt ?? new Date(0).toISOString(),
    monthlyIncome,
    monthlyExpenses,
    emergencyBufferMonths,
    availableMonthlyCashflow,
    committedMonthlyTotal: total,
    commitmentsByDomain: byDomain,
    committedExcludingDomain,
  };
}

// The committed-elsewhere figure a given domain's projector must use. A
// domain with its own active commitment gets the total minus that
// commitment (counted once); any other domain gets the full total.
export function committedExcludingDomain(snapshot, domain) {
  if (!snapshot) return 0;
  const map = snapshot.committedExcludingDomain ?? {};
  if (domain in map) return map[domain];
  return snapshot.committedMonthlyTotal ?? 0;
}

// A small deterministic string hash (djb2) so the module has zero deps.
function cheapHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 16);
}
