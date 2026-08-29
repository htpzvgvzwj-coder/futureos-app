// Wedding Living Plan - estimate provenance.
//
// FutureOS has no live vendor integration. Every wedding cost it shows is a
// Singapore reference-rate ESTIMATE, and it must say so: source, type,
// as-of date, region, a low/expected/high range and a confidence, with the
// assumptions spelled out. The word "quote" is reserved for a real
// document the customer has uploaded.

export const WEDDING_RATE_PROVENANCE = [
  {
    field: "venue",
    sourceName: "Singapore banquet reference rates",
    sourceType: "reference_estimate",
    asOf: "2026-07",
    region: "Singapore",
    range: { low: 0.8, expected: 1.0, high: 1.35 }, // multipliers on the expected per-table figure
    confidence: "medium",
    assumptions: [
      "Per-table pricing for hotel/restaurant; per-head for community venues.",
      "Hotel figures include the standard 10% service charge + 9% GST.",
    ],
  },
  {
    field: "photography",
    sourceName: "Singapore photography/videography package rates",
    sourceType: "reference_estimate",
    asOf: "2026-07",
    region: "Singapore",
    range: { low: 0.75, expected: 1.0, high: 1.4 },
    confidence: "medium",
    assumptions: ["Flat-fee full-coverage packages; does not scale with guest count."],
  },
  {
    field: "attire",
    sourceName: "Singapore bridal + groom attire rental rates",
    sourceType: "reference_estimate",
    asOf: "2026-07",
    region: "Singapore",
    range: { low: 0.7, expected: 1.0, high: 1.5 },
    confidence: "low",
    assumptions: ["Rental (not purchase); premium suit figure is extrapolated."],
  },
];

// A single line the UI can show next to any wedding cost.
export const WEDDING_ESTIMATE_DISCLAIMER =
  "Singapore reference-rate estimate - not a vendor quote. Upload a real quote to firm it up.";
