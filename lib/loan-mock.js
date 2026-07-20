// Local, deterministic stand-in for the Anthropic call used only when the real API request fails
// (e.g. no API credits) - see app/api/loan/stage1/route.js. Mirrors lib/investment-mock.js's
// pattern: the mock only ever supplies `loan_amount_estimate` and narrative text - every real
// installment/tenure/archetype figure is computed separately by lib/loan-finance.js once the
// customer picks an archetype at app/api/loan/confirm, never by this mock or the AI. Clearly
// flagged with `mocked: true` in the route response.

const SIZING_TEMPLATES = {
  renovation: [
    {
      id: "mock-loan-reno-modest",
      label: "Refresh (kitchen + bathroom)",
      loan_amount_estimate: 30000,
      estimate_basis:
        "[Simulated] Approximate cost for a partial renovation covering kitchen and bathroom works, based on general contractor benchmarks - not a live market search.",
      considerations:
        "[Simulated] Renovation loan rates and tenure caps vary by bank; confirm your contractor's quotation before finalising the loan amount.",
    },
    {
      id: "mock-loan-reno-full",
      label: "Full home renovation",
      loan_amount_estimate: 60000,
      estimate_basis:
        "[Simulated] Approximate cost for a full-home renovation (all rooms, flooring, electrical) based on general contractor benchmarks - not a live market search.",
      considerations:
        "[Simulated] Larger renovation loans may need itemised contractor quotes for the bank's disbursement process; confirm your contractor's quotation before finalising.",
    },
  ],
  personal: [
    {
      id: "mock-loan-personal-small",
      label: "Short-term cashflow buffer",
      loan_amount_estimate: 8000,
      estimate_basis: "[Simulated] A modest buffer amount for near-term expenses - based on the customer's stated need, not a live market search.",
      considerations: "[Simulated] Personal loan interest rates depend on your credit profile; compare the effective interest rate (EIR), not just the headline rate.",
    },
    {
      id: "mock-loan-personal-large",
      label: "Larger consolidated amount",
      loan_amount_estimate: 20000,
      estimate_basis: "[Simulated] A larger amount to cover a bigger stated need or to consolidate smaller debts - not a live market search.",
      considerations: "[Simulated] Consider whether a balance transfer or debt consolidation plan may carry a lower effective interest rate than a fresh personal loan.",
    },
  ],
};

export function buildMockSizingOptions(purpose) {
  const templates = SIZING_TEMPLATES[purpose] ?? SIZING_TEMPLATES.personal;
  return {
    sizing_options: templates,
    research_notes:
      "[Simulated response - no live Anthropic API call was made, so these are template loan-amount estimates for testing the app's pipeline, not a real market search. Installment/tenure figures are still computed from the app's own formulas once an archetype is chosen.]",
  };
}
