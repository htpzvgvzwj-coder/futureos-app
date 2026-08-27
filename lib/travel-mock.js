// Local, deterministic stand-in used only when the real Anthropic call
// itself fails - see app/api/travel/stage1/route.js. Mirrors
// lib/wedding-mock.js's pattern. Clearly flagged with "[Simulated]" and
// `mocked: true` in the route response.

const QUOTED_NAME_PATTERN = /"[^"]{2,80}"/;
const CONFIRM_WORD_PATTERN = /\b(confirm|final(ize)?|lock (it|that) in)\b/i;
const PLAN_LETTER_PATTERN = /\bplan\s*([abc123])\b/i;

export function looksLikeConfirmation(message) {
  if (PLAN_LETTER_PATTERN.test(message)) return true;
  return QUOTED_NAME_PATTERN.test(message) && CONFIRM_WORD_PATTERN.test(message);
}

function findMatchingOption(message, options) {
  const quoteMatch = message.match(/"([^"]{2,80})"/);
  if (quoteMatch) {
    const byName = options.find((o) => o.name.toLowerCase() === quoteMatch[1].toLowerCase());
    if (byName) return byName;
  }
  const letterMatch = message.match(PLAN_LETTER_PATTERN);
  if (letterMatch) {
    const index = "abc123".indexOf(letterMatch[1].toLowerCase()) % options.length;
    return options[Math.max(0, index)];
  }
  return options[0];
}

function futureDate(monthsAhead) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

const PLAN_TEMPLATES = [
  {
    name: "Budget-Conscious Family Trip",
    destination: "Kuala Lumpur, Malaysia",
    travelerCount: 4,
    tripLengthDays: 4,
    lineItems: [
      { category: "flights", label: "Return flights, budget carrier", unit_rate: 180, unit: "per person", quantity: 4, estimate_basis: "[Simulated] Typical budget-airline return fare for this route" },
      { category: "accommodation", label: "3-star family hotel room", unit_rate: 120, unit: "per night", quantity: 3, estimate_basis: "[Simulated] Typical 3-star family room rate" },
      { category: "activities", label: "Family attractions pass", unit_rate: 40, unit: "per person", quantity: 4, estimate_basis: "[Simulated] Typical combined attraction ticket pricing" },
      { category: "food", label: "Meals", unit_rate: 25, unit: "per person per day", quantity: 16, estimate_basis: "[Simulated] Typical local meal cost" },
    ],
    itinerary: [
      { dayNumber: 1, label: "Arrival, check in, evening at a night market", location: "City centre", isPhotoSpot: false },
      { dayNumber: 2, label: "Iconic landmark visit and family attraction", location: "City landmark", isPhotoSpot: true },
      { dayNumber: 3, label: "Theme park or nature day", location: "Family attraction", isPhotoSpot: true },
      { dayNumber: 4, label: "Last-minute shopping, departure", location: "City centre", isPhotoSpot: false },
    ],
  },
  {
    name: "Comfortable Family Getaway",
    destination: "Tokyo, Japan",
    travelerCount: 4,
    tripLengthDays: 6,
    lineItems: [
      { category: "flights", label: "Return flights, full-service carrier", unit_rate: 650, unit: "per person", quantity: 4, estimate_basis: "[Simulated] Typical full-service return fare for this route" },
      { category: "accommodation", label: "4-star family hotel room", unit_rate: 280, unit: "per night", quantity: 5, estimate_basis: "[Simulated] Typical 4-star family room rate" },
      { category: "activities", label: "Theme park tickets", unit_rate: 90, unit: "per person", quantity: 4, estimate_basis: "[Simulated] Typical major theme park ticket pricing" },
      { category: "local_transport", label: "Rail pass", unit_rate: 45, unit: "per person", quantity: 4, estimate_basis: "[Simulated] Typical multi-day rail pass" },
      { category: "food", label: "Meals", unit_rate: 40, unit: "per person per day", quantity: 24, estimate_basis: "[Simulated] Typical local meal cost" },
    ],
    itinerary: [
      { dayNumber: 1, label: "Arrival, check in, evening at a famous crossing", location: "Shibuya", isPhotoSpot: true },
      { dayNumber: 2, label: "Historic temple and shopping street", location: "Asakusa", isPhotoSpot: true },
      { dayNumber: 3, label: "Theme park day", location: "Family theme park", isPhotoSpot: true },
      { dayNumber: 4, label: "Panoramic city views and electronics district", location: "Tokyo Tower / Akihabara", isPhotoSpot: true },
      { dayNumber: 5, label: "Day trip to a scenic nearby town", location: "Nearby scenic town", isPhotoSpot: true },
      { dayNumber: 6, label: "Last-minute shopping, departure", location: "City centre", isPhotoSpot: false },
    ],
  },
];

function buildPlan(template, index) {
  const lineItems = template.lineItems.map((item) => ({ ...item, subtotal: Math.round(item.unit_rate * item.quantity * 100) / 100 }));
  return {
    id: `mock-travel-plan-${index + 1}`,
    name: template.name,
    summary: `[Simulated] A ${index === 0 ? "leaner" : "more comfortable"} family trip option, itemised below.`,
    total_cost: 0,
    currency: "SGD",
    destination: template.destination,
    traveler_count: template.travelerCount,
    trip_length_days: template.tripLengthDays,
    line_items: lineItems,
    itinerary: template.itinerary.map((item) => ({
      day_number: item.dayNumber,
      label: item.label,
      location: item.location,
      is_photo_spot: item.isPhotoSpot,
      notes: "",
    })),
  };
}

export function buildMockTravelPlanOptions() {
  return {
    plans: PLAN_TEMPLATES.map(buildPlan),
    research_notes: "[Simulated response - no live Anthropic API call was made. Every figure above is a placeholder, not real market research.]",
  };
}

export function buildMockTravelConfirmation(message, previousPlanOptions) {
  const plans = previousPlanOptions?.plans ?? buildMockTravelPlanOptions().plans;
  const chosen = findMatchingOption(message, plans) ?? plans[0];

  return {
    plan_id: chosen.id,
    travel_date: futureDate(6),
    total_budget: 0,
    currency: chosen.currency,
    destination: chosen.destination,
    traveler_count: chosen.traveler_count,
    trip_length_days: chosen.trip_length_days,
    line_items: chosen.line_items,
    itinerary: chosen.itinerary,
    confirmation_note: "[Simulated] Customer confirmed this plan - no live Anthropic API call was made.",
  };
}
