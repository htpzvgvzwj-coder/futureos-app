// Local, deterministic stand-in for the Anthropic call used only when the real API request fails
// (e.g. no API credits) - see app/api/investment/stage1/route.js. Mirrors lib/retirement-mock.js's
// pattern, but this domain has no numeric fields at all (see lib/investment-tools.js's header
// comment): the mock only ever writes narrative text for the shortlist entries it's given -
// every dollar figure, percentage, and score was already computed by lib/investment-finance.js
// before this ever runs. Clearly flagged with `mocked: true` in the route response.

export function buildMockNarrative(shortlistItems, context) {
  const { purchaseMode, riskBand, goalCategory } = context;

  const narratives = shortlistItems.map((item) => ({
    entry_id: item.entry_id,
    why_recommended: `[Simulated] Included on your shortlist based on your ${riskBand ?? "stated"} risk preference and ${goalCategory ?? "investing"} goal - no live AI reasoning was applied, this is a template explanation for testing the app's pipeline.`,
    purchase_mode_commentary: `[Simulated] Generally suitable for a ${purchaseMode ?? "standard"} purchase, subject to the instrument's own minimums and fees shown above - template commentary, not real AI reasoning.`,
    risk_disclosure:
      "[Simulated] All investments carry risk of loss, including possible loss of principal; past performance does not guarantee future returns. This is a template disclosure for testing, not a substitute for a real risk assessment.",
  }));

  return {
    narratives,
    portfolio_overview:
      "[Simulated] This shortlist is grouped to balance your stated risk preference against your goal and existing holdings - no live Anthropic API call was made, so this is a template overview for testing the app's pipeline.",
    research_notes:
      "[Simulated response - no live Anthropic API call was made. The shortlist itself, and every number shown against each instrument, was still computed by the app's own scoring logic, not this mock.]",
  };
}
