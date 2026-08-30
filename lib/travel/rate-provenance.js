// Travel Living Plan - estimate provenance. No live booking / vendor
// integration; every figure is a reference-rate estimate.

export const TRAVEL_RATE_PROVENANCE = [
  {
    field: "accommodation_and_living",
    sourceName: "Reference nightly cost per traveller by region + comfort",
    sourceType: "reference_estimate",
    asOf: "2026-07",
    region: "from Singapore",
    range: { low: 0.7, expected: 1.0, high: 1.6 },
    confidence: "low",
    assumptions: ["Accommodation + food + local transport, per traveller per night.", "Peak-season and city-centre stays run higher."],
  },
  {
    field: "flights",
    sourceName: "Reference return airfare by region + cabin",
    sourceType: "reference_estimate",
    asOf: "2026-07",
    region: "from Singapore",
    range: { low: 0.6, expected: 1.0, high: 2.0 },
    confidence: "low",
    assumptions: ["Return economy/premium by region.", "Highly date-sensitive - a real fare quote firms this up."],
  },
];

export const TRAVEL_ESTIMATE_DISCLAIMER =
  "Reference-rate estimate, not a fare or hotel quote. Date and destination move this a lot.";
