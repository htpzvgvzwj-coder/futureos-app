// Thread Memory Scrubber (Living Thread commit 12) - pure, no DB/AI.
//
// Where Memory Lens answers "why is my life like this now?" as a causal
// CHAIN, the Memory Scrubber lets the customer drag a handle back through
// the real plan_versions of ONE Studio and see the plan state at that
// point - Before | After - with the fields that actually changed at each
// step. History is append-only: a version supersedes, never rewrites. No
// value is invented; a field absent from a version reads as `unknown`.

// The domain-relevant fields to diff per Studio (keeps the Before/After
// panel focused on what the customer actually moves).
export const MEMORY_SCRUB_KEYS = {
  home: ["estimated_price", "target_complete_month", "monthly_contribution", "down_payment_needed", "loan_tenure", "rate_assumption"],
  emergency: ["target_months", "floor_months", "monthly_contribution", "essential_share"],
  loan: ["extra_repayment", "monthly_installment", "one_off_payment", "target_debt", "repayment_strategy"],
  retirement: ["monthly_contribution", "future_age", "future_day", "inflation_assumption", "real_return_assumption"],
  travel: ["travellers", "nights", "comfort_tier", "destination_type", "trip_month", "total_budget", "monthly_contribution"],
  investment: ["monthly_commitment", "jobs", "liquidity_gate_years", "target_pool", "horizon_years"],
  insurance: ["monthly_premium_now", "income_protection_months", "desired_cover", "existing_income_protection", "existing_life_cover", "existing_ci_cover"],
  family: ["shared_monthly_contribution", "partner_share_ratio", "items"],
  wedding: ["wedding_date", "guest_count", "venue_tier", "venue_type", "photography_tier", "attire_tier", "total_budget", "monthly_contribution", "partner_contribution"],
};

function keysFor(domain, explicit) {
  if (Array.isArray(explicit) && explicit.length) return explicit;
  return MEMORY_SCRUB_KEYS[domain] ?? null;
}

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return {};
  if (!keys) return { ...obj };
  const out = {};
  for (const k of keys) out[k] = k in obj ? obj[k] : undefined;
  return out;
}

function diff(before, after, keys) {
  const ks = keys ?? Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  const changed = [];
  const deltas = {};
  for (const k of ks) {
    const b = before?.[k];
    const a = after?.[k];
    const same = JSON.stringify(b ?? null) === JSON.stringify(a ?? null);
    if (!same) {
      changed.push(k);
      deltas[k] = { before: b === undefined ? "unknown" : b, after: a === undefined ? "unknown" : a };
    }
  }
  return { changedKeys: changed, deltas };
}

// planVersions: rows from plan_versions (any order; each has { version,
//   supersedes_version, actor, data, cause, created_at }).
// events: Change Ledger rows for the same plan (used only as annotations).
export function buildMemoryScrub({ domain, planVersions = [], events = [], focusKeys = null }) {
  const keys = keysFor(domain, focusKeys);
  const ordered = [...planVersions].sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));

  const frames = ordered.map((v, i) => {
    const state = pick(v.data ?? v.state_at_version ?? {}, keys);
    const prev = i > 0 ? pick(ordered[i - 1].data ?? {}, keys) : {};
    const d = diff(prev, state, keys);
    // Ledger events recorded between the previous version and this one.
    const from = i > 0 ? new Date(ordered[i - 1].created_at ?? 0).getTime() : 0;
    const to = new Date(v.created_at ?? 0).getTime();
    const notes = events
      .filter((e) => {
        const t = new Date(e.occurred_at ?? e.occurredAt ?? 0).getTime();
        return t > from && t <= to + 1000;
      })
      .map((e) => ({ actionType: e.action_type, actor: e.actor, messageKey: e.message_key, at: e.occurred_at ?? null }));

    return {
      index: i,
      version: v.version,
      supersedesVersion: v.supersedes_version ?? null,
      at: v.created_at ?? null,
      actor: v.actor ?? "system",
      cause: v.cause ?? {},
      state,
      // Frame 0 is the origin - nothing changed INTO it.
      changedKeys: i === 0 ? [] : d.changedKeys,
      notes,
    };
  });

  // Before/After for a scrub position: the state at `index` vs the one
  // before it. Defaults to the latest step.
  const beforeAfter = (index) => {
    const i = Number.isInteger(index) ? Math.max(0, Math.min(frames.length - 1, index)) : frames.length - 1;
    if (frames.length === 0) return { index: 0, before: {}, after: {}, changedKeys: [], deltas: {} };
    const after = frames[i].state;
    const before = i > 0 ? frames[i - 1].state : {};
    const d = diff(before, after, keys);
    return { index: i, at: frames[i].at, actor: frames[i].actor, before, after, changedKeys: d.changedKeys, deltas: d.deltas, notes: frames[i].notes };
  };

  return {
    domain,
    keys: keys ?? [],
    frames,
    count: frames.length,
    // convenience: the most recent Before/After
    latest: beforeAfter(frames.length - 1),
    // the scrub function is exposed for callers that keep the object around;
    // the route also returns `frames` so a client can compute any position.
    beforeAfter,
  };
}
