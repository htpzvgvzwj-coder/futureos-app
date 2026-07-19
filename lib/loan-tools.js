// Raw JSON Schema tool definition sent to the Claude API. Only ONE AI tool
// exists for this domain: propose_loan_sizing, used for the two unsecured
// purposes (renovation/personal) where the loan amount needs market
// grounding or customer-stated capture. The `home` purpose never reaches
// this tool at all — its principal is read directly from the already-
// confirmed Home Purchase Plan (lib/loan-context.js). Once a sizing amount
// is known (either from this tool or the home cross-read), archetype and
// modifier selection is a structured UI pick with nothing for an LLM to
// interpret, so it's validated and persisted by a plain REST endpoint
// (app/api/loan/confirm/route.js) instead of a second AI tool — see
// lib/loan-validation.js's confirmLoanSchema.

const sizingOptionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    loan_amount_estimate: { type: "number", description: "Estimated loan amount needed, in SGD" },
    estimate_basis: { type: "string", description: "What informed this estimate (market benchmark, or the amount the customer stated)" },
    considerations: { type: "string", description: "Eligibility/practical notes — narrative, not numbers" },
  },
  required: ["id", "label", "loan_amount_estimate", "estimate_basis", "considerations"],
  additionalProperties: false,
};

// max_uses bounds worst-case latency, same lesson as every other domain in
// this codebase — trimmed from day one instead of after the fact.
export const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 2 };

export const PROPOSE_LOAN_SIZING_TOOL = {
  name: "propose_loan_sizing",
  description:
    "Present 1-2 loan-amount sizing options for the customer's stated purpose (renovation or personal). Do NOT compute monthly installment, tenure, or any archetype/strategy figures — the app handles loan-strategy selection separately once a sizing amount is chosen.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      sizing_options: { type: "array", items: sizingOptionSchema },
      research_notes: { type: "string", description: "General notes on the market research (or customer's stated figures) behind these estimates." },
    },
    required: ["sizing_options", "research_notes"],
    additionalProperties: false,
  },
};
