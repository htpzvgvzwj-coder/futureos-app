// parseAsk — turn what someone typed in Explore's "what do you want to
// test?" box (or a Studio's ask box) into a real Future Field peel: which
// field, and what value. Pure regex, no model call — it only ever
// pre-fills the peel form; nothing is proposed or saved until the person
// reviews it and taps Peel themselves.

const NUM = /(-?\d[\d,]*(?:\.\d+)?)\s*(k|month|months?|mo|year|years?|yr)?/i;
const A_UNIT = /\ba\s+(month|year)\b/i; // "push it back a year" - no digit to match

function parseNumber(text) {
  const m = NUM.exec(text);
  if (m) {
    let n = Number(m[1].replace(/,/g, ""));
    const unit = (m[2] || "").toLowerCase();
    if (unit === "k") n *= 1000;
    return { value: n, unit: /year|yr/.test(unit) ? "years" : /month|mo/.test(unit) ? "months" : null };
  }
  const a = A_UNIT.exec(text);
  if (a) return { value: 1, unit: a[1].toLowerCase() === "year" ? "years" : "months" };
  return null;
}

const SOONER = /\b(sooner|earlier|faster|quicker|bring.*(closer|forward)|move.*(up|earlier))\b/i;
const LATER = /\b(later|slower|delay|push.*back|hold off)\b/i;

// property_type keyword -> the real Living Plan enum value (registry.js:
// ["hdb_new", "hdb_resale", "ec_new", "private"]). "Condo"/"landed"/
// "bungalow" all mean private property in Singapore; EC (executive
// condo) and BTO/resale HDB are their own categories. Order matters —
// checked in sequence, so the more specific "executive condo" wins over
// a bare "condo".
const PROPERTY_TYPE_OPTIONS = [
  { re: /executive condo|\bec\b/i, value: "ec_new" },
  { re: /condo|private|landed|bungalow|semi-d|terrace/i, value: "private" },
  { re: /\bbto\b|new flat|new hdb/i, value: "hdb_new" },
  { re: /\bhdb\b|\bflat\b|resale/i, value: "hdb_resale" },
];
const PROPERTY_TYPE_MATCH = /condo|private|landed|bungalow|semi-d|terrace|executive condo|\bec\b|\bbto\b|new flat|new hdb|\bhdb\b|\bflat\b|resale/i;

// domain -> [{ field, kind, match: RegExp, monthAnchor?: true, options? }]
// monthAnchor fields are shifted by a signed month count (sooner/later);
// "select" fields resolve to one of `options` via its own sub-matchers
// (see PROPERTY_TYPE_OPTIONS); everything else takes the parsed number
// directly.
const DOMAIN_FIELDS = {
  home: [
    { field: "target_complete_month", kind: "month", monthAnchor: true, match: /sooner|earlier|later|delay|buy|move/i },
    { field: "estimated_price", kind: "money", match: /price|cost|worth|value/i },
    { field: "monthly_contribution", kind: "money", match: /month|contribut|save|put (in|aside)/i },
    { field: "property_type", kind: "select", match: PROPERTY_TYPE_MATCH, options: PROPERTY_TYPE_OPTIONS },
  ],
  wedding: [
    { field: "wedding_date", kind: "month", monthAnchor: true, match: /sooner|earlier|later|delay|date|when/i },
    { field: "guest_count", kind: "count", match: /guest|pax|people|attend/i },
    { field: "total_budget", kind: "money", match: /budget|total|cost/i },
    { field: "monthly_contribution", kind: "money", match: /month|contribut|save/i },
  ],
  loan: [
    { field: "extra_repayment", kind: "money", match: /extra|more|pay.*(down|off|faster)/i },
    { field: "monthly_installment", kind: "money", match: /instal|repay|month/i },
  ],
  retirement: [
    { field: "monthly_contribution", kind: "money", match: /month|contribut|save/i },
    { field: "target_monthly_income", kind: "money", match: /income|lifestyle|spend/i },
  ],
  travel: [
    { field: "trip_month", kind: "month", monthAnchor: true, match: /sooner|earlier|later|delay|when|month/i },
    { field: "total_budget", kind: "money", match: /budget|cost|spend/i },
    { field: "travellers", kind: "count", match: /people|traveller|pax/i },
  ],
  investment: [
    { field: "monthly_commitment", kind: "money", match: /month|invest|put (in|aside)/i },
    { field: "target_pool", kind: "money", match: /target|goal|pool/i },
  ],
  insurance: [
    { field: "existing_life_cover", kind: "money", match: /life cover|cover|sum assured/i },
    { field: "monthly_premium_now", kind: "money", match: /premium|month/i },
  ],
  emergency: [
    { field: "target_months", kind: "count", match: /month|target|cushion/i },
    { field: "monthly_contribution", kind: "money", match: /month|save|contribut/i },
  ],
  family: [
    { field: "shared_monthly_contribution", kind: "money", match: /month|share|contribut/i },
  ],
};

export function parseAsk(text, domain) {
  const t = String(text || "").trim();
  if (t.length < 3) return null;
  const fields = DOMAIN_FIELDS[domain] ?? DOMAIN_FIELDS.home;
  const num = parseNumber(t);
  const sooner = SOONER.test(t);
  const later = LATER.test(t);

  // month-anchor fields first when the ask is clearly about timing
  if (sooner || later) {
    const mf = fields.find((f) => f.monthAnchor);
    if (mf) {
      const months = num?.value ? Math.round(num.unit === "years" ? num.value * 12 : num.value) : 6;
      const shift = sooner ? -Math.abs(months) : Math.abs(months);
      return { field: mf.field, kind: mf.kind, shiftMonths: shift, label: t.slice(0, 60) };
    }
  }
  // "select" fields (e.g. property_type) resolve to a real option value
  // straight from the text, never from a parsed number — checked before
  // the numeric branch so "a condo in Bugis" doesn't fall through empty
  // just because it has no digits.
  const selectField = fields.find((f) => f.kind === "select" && f.match.test(t));
  if (selectField) {
    const opt = selectField.options.find((o) => o.re.test(t));
    if (opt) return { field: selectField.field, kind: "select", value: opt.value, label: t.slice(0, 60) };
  }

  // Regression: a number with NO field-specific keyword nearby used to
  // fall back to whichever field happened to be listed first for the
  // domain, regardless of relevance -- "can i Buy $150000 car" (no
  // wedding keyword at all) silently set the WEDDING plan's guest_count
  // to 150,000, which then got peeled AND auto-activated as the live
  // plan (peel always auto-activates by design). A number only ever
  // targets a field whose own keyword is actually present in the text;
  // otherwise this is an honest "couldn't tell", same as no number at
  // all — never a guess at which field the customer meant.
  if (num?.value != null) {
    const f = fields.find((x) => x.match.test(t) && !x.monthAnchor && x.kind !== "select");
    if (f) return { field: f.field, kind: f.kind, value: Math.round(num.value), label: t.slice(0, 60) };
  }
  // no number, but a clear field was named — still worth opening that field
  const named = fields.find((f) => f.match.test(t) && !f.monthAnchor && f.kind !== "select");
  if (named) return { field: named.field, kind: named.kind, value: null, label: t.slice(0, 60) };
  return null;
}
