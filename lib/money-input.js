// Money input parsing (Studio first-use fix). Accepts what a real person
// types - "1000", "1,000", "SGD 1,000", "$1,000.50", "1.5k" - and returns
// a normalised number, or a clear inline error the APP shows (never the
// browser's native "Enter a real number" bubble).
//
// Pure. No dependency.

const CURRENCY_WORDS = /\b(sgd|usd|myr|eur|gbp|aud|rm|s\$|us\$)\b/gi;

// parseMoneyInput("SGD 1,000") -> { ok: true, value: 1000 }
// parseMoneyInput("abc")       -> { ok: false, error: "Enter an amount such as 1,000" }
export function parseMoneyInput(raw, { min = 0, max = 1e12, allowZero = true } = {}) {
  if (raw == null) return { ok: false, error: "Enter an amount such as 1,000" };
  let s = String(raw).trim();
  if (s === "") return { ok: false, error: "Enter an amount such as 1,000" };

  // strip currency symbols / words and spaces
  s = s.replace(/[$£€]/g, "").replace(CURRENCY_WORDS, "").replace(/\s+/g, "").trim();

  // "1.5k" / "2m" shorthand
  const shorthand = /^(-?\d*\.?\d+)([km])$/i.exec(s);
  let n;
  if (shorthand) {
    n = parseFloat(shorthand[1]) * (shorthand[2].toLowerCase() === "k" ? 1_000 : 1_000_000);
  } else {
    // remove thousands separators; keep a single decimal point
    const cleaned = s.replace(/,/g, "");
    if (!/^-?\d*\.?\d+$/.test(cleaned)) {
      return { ok: false, error: "Enter an amount such as 1,000" };
    }
    n = parseFloat(cleaned);
  }

  if (!Number.isFinite(n)) return { ok: false, error: "Enter an amount such as 1,000" };
  if (n < 0) return { ok: false, error: "Amount can't be negative" };
  if (!allowZero && n === 0) return { ok: false, error: "Enter an amount greater than 0" };
  if (n < min) return { ok: false, error: `Enter at least ${formatMoney(min)}` };
  if (n > max) return { ok: false, error: `Enter at most ${formatMoney(max)}` };

  return { ok: true, value: Math.round(n * 100) / 100 };
}

// Display formatting for a blurred field: 1000 -> "1,000".
export function formatMoney(n, { currency = "" } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  const body = Math.round(v).toLocaleString("en-SG");
  return currency ? `${currency} ${body}` : body;
}

// A range chip value like "300k-500k" or "under-3m" -> a representative
// midpoint number + { low, high } for provenance "user_range".
export function midpointOfRange(rangeId) {
  if (!rangeId || typeof rangeId !== "string") return null;
  const m = /^(under|over)?[-_]?(\d+(?:\.\d+)?)([km]?)(?:[-_](\d+(?:\.\d+)?)([km]?))?$/i.exec(rangeId.trim());
  if (!m) return null;
  const scale = (suffix) => (suffix?.toLowerCase() === "k" ? 1_000 : suffix?.toLowerCase() === "m" ? 1_000_000 : 1);
  const a = parseFloat(m[2]) * scale(m[3]);
  const b = m[4] != null ? parseFloat(m[4]) * scale(m[5]) : null;
  if (m[1]?.toLowerCase() === "under") return { value: Math.round(a * 0.7), low: 0, high: a };
  if (m[1]?.toLowerCase() === "over") return { value: Math.round(a * 1.3), low: a, high: null };
  if (b == null) return { value: Math.round(a), low: a, high: a };
  return { value: Math.round((a + b) / 2), low: a, high: b };
}
