// "Try a change" (PullFold) — a free-text box next to the slider, so a
// typed request ("6 months sooner", "invest SGD 500 a month", "retire at
// 60") moves the SAME slider the drag gesture does, rather than only
// accepting a drag. Pure — no DB, no fetch.
//
// One node -> one field -> one unit (lib/life/pull.js's PULLABLE), so this
// only needs to parse a value in THAT unit, not guess a field.

const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

const SOONER = /(\d+(?:\.\d+)?)\s*(month|months|mo|yr|yrs|year|years)?\s*(?:sooner|earlier)/i;
const LATER = /(\d+(?:\.\d+)?)\s*(month|months|mo|yr|yrs|year|years)?\s*later/i;
// no-digit phrasing: "a year sooner", "a month later"
const A_SOONER = /\ba\s+(month|year)\s*(?:sooner|earlier)/i;
const A_LATER = /\ba\s+(month|year)\s*later/i;
const NUM = /(-?\d[\d,]*(?:\.\d+)?)\s*(k)?/i;
const isYearUnit = (u) => /year|yr/i.test(u || "");

// text, the node's buildPullSpec() result -> a slider value in spec's own
// unit, clamped to its range, or null if nothing usable was typed.
export function parsePullAsk(text, spec) {
  const t = String(text || "").trim();
  if (t.length < 2 || !spec) return null;

  if (spec.unit === "months_shift") {
    const sooner = SOONER.exec(t);
    const later = !sooner && LATER.exec(t);
    const m = sooner || later;
    if (m) {
      const n = Number(m[1]) * (isYearUnit(m[2]) ? 12 : 1);
      return clampInt(sooner ? -n : n, spec.sliderMin, spec.sliderMax);
    }
    const aSooner = A_SOONER.exec(t);
    const aLater = !aSooner && A_LATER.exec(t);
    const am = aSooner || aLater;
    if (am) {
      const n = isYearUnit(am[1]) ? 12 : 1;
      return clampInt(aSooner ? -n : n, spec.sliderMin, spec.sliderMax);
    }
    // a bare signed number ("-6", "+9") is taken as months, sign as given
    const bare = /^[+-]?\d+(?:\.\d+)?$/.exec(t);
    if (bare) return clampInt(Number(bare[0]), spec.sliderMin, spec.sliderMax);
    return null;
  }

  // months_cushion, sgd_per_month, age — all just "a number", possibly
  // "k"-suffixed for money ("2k" -> 2000).
  const m = NUM.exec(t);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 1000;
  return clampInt(n, spec.sliderMin, spec.sliderMax);
}
