// Family Travel - mirrors lib/wedding-tools.js's stage1 shape exactly
// (propose_plans / confirm_*), but with no server-computed rate-table
// split like wedding's venue/photography/attire - travel has no
// equivalent official rate table, so every line item is AI-proposed with
// real web_search grounding (same WEB_SEARCH_TOOL wedding already uses),
// and the total is still recomputed server-side from the real line items
// sum, never trusted from the model (lib/travel-validation.js).

const travelLineItemSchema = {
  type: "object",
  properties: {
    category: { type: "string", description: "e.g. flights, accommodation, activities, food, local_transport, misc" },
    label: { type: "string" },
    unit_rate: { type: "number" },
    unit: { type: "string", description: "e.g. 'per person', 'per night', 'flat fee'" },
    quantity: { type: "number" },
    subtotal: { type: "number" },
    estimate_basis: { type: "string", description: "What real market research informed this number - never an unexplained figure." },
  },
  required: ["category", "label", "unit_rate", "unit", "quantity", "subtotal", "estimate_basis"],
  additionalProperties: false,
};

const itineraryItemSchema = {
  type: "object",
  properties: {
    day_number: { type: "number" },
    label: { type: "string", description: "What happens this day, e.g. 'Arrival, check in, evening at Shibuya Crossing'" },
    location: { type: "string", description: "e.g. 'Shibuya, Tokyo'" },
    is_photo_spot: { type: "boolean", description: "A real, well-known spot worth a photo/check-in, not every stop." },
    notes: { type: "string" },
  },
  required: ["day_number", "label", "location", "is_photo_spot", "notes"],
  additionalProperties: false,
};

const travelPlanSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    total_cost: { type: "number" },
    currency: { type: "string" },
    destination: { type: "string" },
    traveler_count: { type: "number" },
    trip_length_days: { type: "number" },
    line_items: { type: "array", items: travelLineItemSchema },
    itinerary: { type: "array", items: itineraryItemSchema },
  },
  required: ["id", "name", "summary", "total_cost", "currency", "destination", "traveler_count", "trip_length_days", "line_items", "itinerary"],
  additionalProperties: false,
};

export const PROPOSE_TRAVEL_PLANS_TOOL = {
  name: "propose_travel_plans",
  description:
    "Present 2-3 distinct complete family travel plan options for comparison, each with a real market-researched budget breakdown AND a real day-by-day itinerary (destinations, attractions, real well-known photo/check-in spots). Use web_search to ground every cost estimate in real current pricing - never an unexplained number.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plans: { type: "array", items: travelPlanSchema },
      research_notes: { type: "string", description: "General notes on the market research behind the line item estimates." },
    },
    required: ["plans", "research_notes"],
    additionalProperties: false,
  },
};

export const CONFIRM_TRAVEL_PLAN_TOOL = {
  name: "confirm_travel_plan",
  description: "Call this ONLY when the customer has unambiguously confirmed one specific final plan.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      plan_id: { type: "string" },
      travel_date: { type: "string", description: "ISO date of trip start, e.g. 2027-06-15" },
      total_budget: { type: "number" },
      currency: { type: "string" },
      destination: { type: "string" },
      traveler_count: { type: "number" },
      trip_length_days: { type: "number" },
      line_items: { type: "array", items: travelLineItemSchema },
      itinerary: { type: "array", items: itineraryItemSchema },
      confirmation_note: { type: "string" },
    },
    required: [
      "plan_id",
      "travel_date",
      "total_budget",
      "currency",
      "destination",
      "traveler_count",
      "trip_length_days",
      "line_items",
      "itinerary",
      "confirmation_note",
    ],
    additionalProperties: false,
  },
};
