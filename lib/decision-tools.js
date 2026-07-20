// Raw JSON Schema tool definition sent to the Claude API. Only ONE AI tool exists for this domain:
// narrate_verdict - it has ZERO numeric fields, same "AI touches zero numbers" bar as
// lib/investment-tools.js. The verdict category and every dollar figure are computed entirely by
// lib/decision-finance.js before the AI ever sees them; the AI's only job is to explain a verdict
// it did not choose and cannot alter, in plain language, fast enough to be useful standing in a
// showroom or at a vendor meeting.

export const NARRATE_VERDICT_TOOL = {
  name: "narrate_verdict",
  description:
    "Write a short, plain-language explanation of a spending verdict that has ALREADY been decided by the app's own cashflow math (given in the system prompt). Do NOT restate, alter, soften, or contradict the verdict category or any number given to you. Do NOT invent an opinion on whether the price itself is a fair market rate - you were only given the verdict and its cashflow impact, not asked to price-check the purchase.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      narrative: {
        type: "string",
        description: "2-3 sentence plain-language explanation of the verdict, referencing the real numbers given - no invented figures.",
      },
      key_consideration: {
        type: "string",
        description: "One honest, specific caveat or thing to double check before proceeding - not generic boilerplate.",
      },
    },
    required: ["narrative", "key_consideration"],
    additionalProperties: false,
  },
};
