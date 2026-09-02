// Shared formatting for the Future Bank surfaces. Honest by construction:
// null / undefined -> "Needs more information", never 0.

export const CURRENCY = "SGD";

export function money(n, { currency = CURRENCY, signed = false } = {}) {
  const v = Number(n);
  if (n == null || !Number.isFinite(v)) return "Needs more information";
  const abs = Math.round(Math.abs(v)).toLocaleString("en-SG");
  const sign = v < 0 ? "−" : signed ? "+" : "";
  return `${sign}${currency} ${abs}`;
}

export function monthly(n, opts) {
  const m = money(n, opts);
  return m === "Needs more information" ? m : `${m}/mo`;
}

export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

export function relTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(iso);
}

// A single affected-plan row's displayed "after" value + its honest label.
export function afterLabel(row) {
  if (row.confirmedAfter != null) return { value: String(row.confirmedAfter), tag: "Committed", tagKind: "committed" };
  if (row.possibleAfter != null) return { value: String(row.possibleAfter), tag: "Preview", tagKind: "preview" };
  return { value: "Needs more information", tag: null, tagKind: null };
}

export function directionClass(row) {
  if (row.favourable === true) return "up";
  if (row.favourable === false) return "down";
  if (row.direction === "up") return "up";
  if (row.direction === "down") return "down";
  return "";
}

// "postPurchaseBufferMonths" / "monthly_breathing_room" -> "post purchase buffer months"
export function humanMetric(m) {
  return String(m ?? "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
}

// A materially-affected row = something the change actually moves (or a
// known-vs-unknown), never a "-136900 -> -136900" no-op.
export function isMaterial(row) {
  const b = Number(row.before);
  const pa = row.confirmedAfter != null ? Number(row.confirmedAfter) : Number(row.possibleAfter);
  if (Number.isFinite(b) && Number.isFinite(pa)) return Math.abs(pa - b) > 1e-6;
  return row.before != null || row.possibleAfter != null || row.confirmedAfter != null;
}
