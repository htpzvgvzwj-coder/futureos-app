// Local, deterministic stand-in used only when the real Anthropic call
// itself fails - see app/api/deal-finder/search/route.js. Clearly flagged
// with "[Simulated]" and `mocked: true` in the route response, same
// convention as every other mock in this app.

export function buildMockDealOptions(query) {
  return {
    query_summary: `[Simulated] Options for: ${query}`,
    options: [
      {
        name: "Standard option",
        vendor: "[Simulated] Vendor A",
        price: 100,
        currency: "SGD",
        unit: "one-time",
        source: "[Simulated] - no live web search was performed",
        notes: "[Simulated] Placeholder pricing - not a real market finding.",
      },
      {
        name: "Budget option",
        vendor: "[Simulated] Vendor B",
        price: 75,
        currency: "SGD",
        unit: "one-time",
        source: "[Simulated] - no live web search was performed",
        notes: "[Simulated] Placeholder pricing - not a real market finding.",
      },
    ],
    research_notes: "[Simulated response - no live Anthropic API call was made. Every figure above is a placeholder, not real market research.]",
  };
}
