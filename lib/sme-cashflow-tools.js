export const NARRATE_CASHFLOW_TOOL = {
  name: "narrate_cashflow",
  description:
    "Write a very short, plain-language summary of a REAL, already-computed cash flow forecast for a small business. One sharp sentence, not a paragraph - the owner is skimming, not reading. Do NOT invent, restate differently, or contradict any number given to you.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      narrative: {
        type: "string",
        description: "ONE short sentence (under 25 words) stating the real headline - is there a gap, when, how bad - no filler.",
      },
      key_consideration: {
        type: "string",
        description: "ONE short phrase or sentence (under 20 words) - if a real fix was found, mention it plainly; otherwise the single thing worth watching.",
      },
    },
    required: ["narrative", "key_consideration"],
    additionalProperties: false,
  },
};
