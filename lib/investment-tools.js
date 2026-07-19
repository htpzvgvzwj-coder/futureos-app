// Raw JSON Schema tool definition sent to the Claude API. Only ONE AI tool
// exists for this domain: propose_investment_narrative, and — unlike every
// other *-tools.js module in this codebase — it has ZERO numeric fields.
// The shortlist (which instruments, in what order), every dollar/percent
// figure, and every score are computed entirely by
// lib/investment-finance.js before the AI ever sees them; the AI's only job
// is to explain a shortlist it did not choose and cannot alter. See
// lib/investment-catalog.js's header comment for why this domain is held to
// a stricter "AI touches zero numbers" bar than loan/wedding/home/
// retirement.

const narrativeEntrySchema = {
  type: "object",
  properties: {
    entry_id: { type: "string", description: "Must exactly match one entry_id from the shortlist given in the system prompt." },
    why_recommended: { type: "string", description: "Why this instrument fits the customer's risk/goal/holdings/cashflow signals — narrative only, no numbers." },
    purchase_mode_commentary: { type: "string", description: "Suitability commentary for the customer's chosen purchase mode against this specific instrument — narrative only, no numbers." },
    risk_disclosure: { type: "string", description: "An honest, specific risk disclosure for this instrument — not generic boilerplate." },
  },
  required: ["entry_id", "why_recommended", "purchase_mode_commentary", "risk_disclosure"],
  additionalProperties: false,
};

export const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 2 };

export const PROPOSE_INVESTMENT_NARRATIVE_TOOL = {
  name: "propose_investment_narrative",
  description:
    "For EACH shortlisted instrument given in the system prompt (identified by entry_id), write why-recommended reasoning, purchase-mode suitability commentary, and a risk disclosure. Do NOT invent, restate with different values, or contradict any dollar figure, percentage, or return/growth number — every number is computed by the app and shown to the customer separately. Do NOT propose, substitute, or add instruments beyond the given shortlist. Produce exactly one narrative object per given entry_id — never fewer, never more.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      narratives: { type: "array", items: narrativeEntrySchema },
      portfolio_overview: { type: "string", description: "A short overview of how this shortlist fits together as a whole for this customer — narrative only, no numbers." },
      research_notes: { type: "string", description: "General notes on the reasoning behind the shortlist ordering, or market context if web_search was used." },
    },
    required: ["narratives", "portfolio_overview", "research_notes"],
    additionalProperties: false,
  },
};
