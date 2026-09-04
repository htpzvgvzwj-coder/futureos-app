// Pull the Future — which Life nodes can be "pulled", and to what.
//
// A node maps to one Studio domain and ONE plan field the customer can
// drag. The slider runs in plain units (months of cushion, months earlier
// / later, dollars per month, an age); `overrideFor` turns a slider
// position back into the real plan override the Future Field expects.
//
// Pure — no DB, no fetch. The component feeds it the plan's current data
// (from /api/future-field?domain=…) and reads back a spec.

const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

// months between two YYYY-MM strings (b - a); null if either is unparseable
function monthDiff(a, b) {
  const pa = /^(\d{4})-(\d{2})/.exec(String(a || ""));
  const pb = /^(\d{4})-(\d{2})/.exec(String(b || ""));
  if (!pa || !pb) return null;
  return (Number(pb[1]) - Number(pa[1])) * 12 + (Number(pb[2]) - Number(pa[2]));
}
function addMonths(yyyymm, delta) {
  const p = /^(\d{4})-(\d{2})/.exec(String(yyyymm || ""));
  const base = p ? new Date(Number(p[1]), Number(p[2]) - 1, 1) : new Date();
  base.setMonth(base.getMonth() + Math.round(Number(delta) || 0));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

// node id -> how it pulls. `range` is in the slider's own unit.
export const PULLABLE = {
  safety: {
    domain: "emergency",
    key: "target_months",
    unit: "months_cushion",
    verb: "Aim for",
    range: { min: 2, max: 12, step: 1 },
  },
  home: {
    domain: "home",
    key: "target_complete_month",
    unit: "months_shift",
    verb: "Buy",
    range: { min: -36, max: 36, step: 3 },
  },
  relationships: {
    domain: "wedding",
    key: "wedding_date",
    unit: "months_shift",
    verb: "Hold the day",
    range: { min: -24, max: 24, step: 3 },
  },
  freedom: {
    domain: "investment",
    key: "monthly_commitment",
    unit: "sgd_per_month",
    verb: "Invest",
    range: { min: 0, max: 3000, step: 100 },
  },
  future: {
    domain: "retirement",
    key: "future_age",
    unit: "age",
    verb: "Retire at",
    range: { min: 55, max: 70, step: 1 },
  },
};

export function isPullable(nodeId) {
  return Object.prototype.hasOwnProperty.call(PULLABLE, nodeId);
}

// Build the slider spec for a node given the plan's current data.
// Returns null when the node isn't pullable or the field is missing.
export function buildPullSpec(nodeId, planData = {}) {
  const cfg = PULLABLE[nodeId];
  if (!cfg) return null;
  const { range } = cfg;

  if (cfg.unit === "months_cushion") {
    const cur = clampInt(planData.target_months ?? planData.floor_months ?? 6, range.min, range.max);
    return { nodeId, ...cfg, sliderMin: range.min, sliderMax: range.max, step: range.step, value: cur, atValue: cur, label: label(cfg, cur) };
  }
  if (cfg.unit === "sgd_per_month") {
    const cur = clampInt(planData.monthly_commitment ?? planData.monthly_contribution ?? 0, range.min, range.max);
    return { nodeId, ...cfg, sliderMin: range.min, sliderMax: range.max, step: range.step, value: cur, atValue: cur, label: label(cfg, cur) };
  }
  if (cfg.unit === "age") {
    const cur = clampInt(planData.future_age ?? 65, range.min, range.max);
    return { nodeId, ...cfg, sliderMin: range.min, sliderMax: range.max, step: range.step, value: cur, atValue: cur, label: label(cfg, cur) };
  }
  // months_shift: slider is an offset around 0 (= today's target)
  const anchor = cfg.key === "target_complete_month" ? planData.target_complete_month : planData.wedding_date;
  return {
    nodeId,
    ...cfg,
    anchor: anchor ?? null,
    sliderMin: range.min,
    sliderMax: range.max,
    step: range.step,
    value: 0,
    atValue: 0,
    label: label(cfg, 0),
  };
}

function label(cfg, v) {
  if (cfg.unit === "months_cushion") return `${cfg.verb} ${v} months of cushion`;
  if (cfg.unit === "sgd_per_month") return `${cfg.verb} SGD ${Number(v).toLocaleString("en-SG")}/month`;
  if (cfg.unit === "age") return `${cfg.verb} ${v}`;
  // months_shift
  if (v === 0) return "At today's plan";
  const n = Math.abs(v);
  return v < 0 ? `${cfg.verb} ${n} months sooner` : `${cfg.verb} ${n} months later`;
}

// slider position -> the { key: value } override the Future Field takes.
export function overrideFor(spec, sliderValue) {
  const v = Number(sliderValue);
  if (!spec) return {};
  if (spec.unit === "months_shift") {
    return { [spec.key]: addMonths(spec.anchor, v) };
  }
  if (spec.unit === "age") return { [spec.key]: clampInt(v, spec.sliderMin, spec.sliderMax) };
  return { [spec.key]: clampInt(v, spec.sliderMin, spec.sliderMax) };
}

// Human line for the current slider position (for the component's live caption).
export function captionFor(spec, sliderValue) {
  return label(spec, Number(sliderValue));
}

export { monthDiff };
