// Same "AI touches zero numbers" bar as lib/decision-tools.js's narrate_verdict - both real
// futures (buy now / wait instead) are already fully computed by
// lib/future-comparison-finance.js before the AI ever sees them.

export const NARRATE_FUTURE_COMPARISON_TOOL = {
  name: "narrate_future_comparison",
  description:
    "Write a very short, plain-language comparison of two REAL, already-computed futures (buying now vs waiting). Real people skim, not read - keep it to one sharp sentence each, not a paragraph. Do NOT invent, restate differently, or contradict any number given to you. Do NOT add a market-price opinion on the purchase itself.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      narrative: {
        type: "string",
        description: "ONE short sentence (under 20 words) stating the real difference between the two futures - no filler, no restating both numbers, just the point.",
      },
      key_consideration: {
        type: "string",
        description: "ONE short phrase or sentence (under 15 words) - the single thing worth weighing. Not a list, not boilerplate.",
      },
    },
    required: ["narrative", "key_consideration"],
    additionalProperties: false,
  },
};
