// Reality Drift (Future Bank, Part 8). Compares what a plan ASSUMED against
// what the ledger has actually OBSERVED, and only raises a drift once there
// is enough observation and the gap is material. A single unusual month
// never moves a long-term plan.
//
// Pure - the planned figures, the observed averages and the observation
// window are all passed in. No DB, no Date.now.

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

export const DRIFT_METRICS = ["monthly_essentials", "monthly_income", "monthly_contribution"];

const DEFAULTS = {
  windowMonths: 3, // need at least this many observed months
  relThreshold: 0.06, // and at least a 6% gap
  absThreshold: 50, // and at least this many currency units
};

// planned:  { monthlyEssentials, monthlyIncome, monthlyContribution }
// observed: { essentialsAvg, incomeAvg, contributionAvg, monthsObserved }
// months per unit of drift -> impact hint (e.g. how a plan month shifts)
export function detectRealityDrift({ planned = {}, observed = {}, thresholds = {}, currency = "SGD", monthsPerImpactUnit = null } = {}) {
  const cfg = { ...DEFAULTS, ...thresholds };
  const monthsObserved = Number(observed.monthsObserved) || 0;
  const cases = [];

  if (monthsObserved < cfg.windowMonths) {
    return { drifted: false, reason: "insufficient_observation", monthsObserved, windowMonths: cfg.windowMonths, cases: [] };
  }

  const check = (metric, plannedVal, observedVal, worseWhenHigher) => {
    const p = money(plannedVal);
    const o = money(observedVal);
    if (p === 0 && o === 0) return;
    const delta = o - p;
    const relC = p === 0 ? 1 : Math.abs(delta) / Math.abs(p);
    if (Math.abs(delta) < cfg.absThreshold || relC < cfg.relThreshold) return;

    const worse = worseWhenHigher ? delta > 0 : delta < 0;
    const impactMonths = monthsPerImpactUnit != null ? round2(Math.abs(delta) * monthsPerImpactUnit) : null;
    cases.push({
      metric,
      planned: round2(p),
      observed: round2(o),
      delta: round2(delta),
      deltaPct: round2(relC * 100),
      direction: delta > 0 ? "higher" : "lower",
      favourable: !worse,
      summary:
        `Your plan assumed ${currency} ${round2(p)} ${metric.replace(/_/g, " ")}. ` +
        `Your ${monthsObserved}-month observed average is ${currency} ${round2(o)}.` +
        (impactMonths ? ` If unchanged, a linked goal may move about ${impactMonths} month${impactMonths === 1 ? "" : "s"} ${worse ? "later" : "earlier"}.` : ""),
      options: ["accept_new_reality", "keep_original_plan", "open_mirror"],
    });
  };

  check("monthly_essentials", planned.monthlyEssentials, observed.essentialsAvg, true);
  check("monthly_income", planned.monthlyIncome, observed.incomeAvg, false);
  check("monthly_contribution", planned.monthlyContribution, observed.contributionAvg, false);

  return {
    drifted: cases.length > 0,
    monthsObserved,
    windowMonths: cfg.windowMonths,
    thresholds: cfg,
    cases,
  };
}

// Helper: turn a list of monthly buckets into the observed averages
// detectRealityDrift expects. buckets: [{ month, essentials, income, contribution }]
export function summariseObserved(buckets = []) {
  const n = buckets.length;
  if (n === 0) return { monthsObserved: 0, essentialsAvg: 0, incomeAvg: 0, contributionAvg: 0 };
  const sum = (k) => buckets.reduce((s, b) => s + money(b[k]), 0);
  return {
    monthsObserved: n,
    essentialsAvg: round2(sum("essentials") / n),
    incomeAvg: round2(sum("income") / n),
    contributionAvg: round2(sum("contribution") / n),
  };
}
