// Deal Finder - the one honest slice of "Agent-to-Agent Commerce" this
// app can actually deliver without either fabricating a fake negotiation
// or standing up a real external merchant/payment integration (neither
// of which exists here). Reuses the exact same real WEB_SEARCH_TOOL
// wedding/home/travel already ground their pricing in - the AI goes out
// and finds real current options with real sources, and reports them for
// the customer to act on themselves. It never claims to have negotiated,
// booked, or transacted anything.

const dealOptionSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "The specific product/service/plan, e.g. 'iPhone 15 128GB'" },
    vendor: { type: "string", description: "The real seller/provider name, e.g. 'Courts', 'Singtel', 'Grab'" },
    price: { type: "number" },
    currency: { type: "string" },
    unit: { type: "string", description: "e.g. 'one-time', 'per month', 'per person', 'per session'" },
    source: { type: "string", description: "Where this real price was found - a real website or vendor name, never an unexplained figure." },
    notes: { type: "string", description: "Anything relevant - conditions, what's included, catches." },
  },
  required: ["name", "vendor", "price", "currency", "unit", "source", "notes"],
  additionalProperties: false,
};

export const PROPOSE_DEAL_OPTIONS_TOOL = {
  name: "propose_deal_options",
  description:
    "Present 2-4 real options found via real web search for what the customer wants to buy or book, each with a real vendor, a real current price, and the real source it came from. This is a real price-comparison snapshot for the customer to act on themselves - never a claim that anything was negotiated, reserved, or purchased.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      query_summary: { type: "string", description: "One short sentence restating what was searched for." },
      options: { type: "array", items: dealOptionSchema },
      research_notes: { type: "string", description: "One short sentence on the real research behind these options - never an AI opinion on which to pick." },
    },
    required: ["query_summary", "options", "research_notes"],
    additionalProperties: false,
  },
};
