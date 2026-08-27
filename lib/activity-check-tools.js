export const NARRATE_ACTIVITY_CHECK_TOOL = {
  name: "narrate_activity_check",
  description:
    "Write a very short, plain-language summary of a REAL, already-computed check of whether a proposed amount is unusual for THIS customer, compared to their own real confirmed history. One sharp sentence, not a paragraph. Do NOT invent, restate differently, or contradict any number given to you. Never call this 'fraud detection' - it is a real comparison against the customer's own history, not a population-level model.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      narrative: {
        type: "string",
        description: "ONE short sentence (under 25 words) stating the real headline - unusual or not, and why, in plain terms.",
      },
      key_consideration: {
        type: "string",
        description: "ONE short phrase or sentence (under 20 words) - the single thing worth double-checking, or a reassurance if genuinely normal.",
      },
    },
    required: ["narrative", "key_consideration"],
    additionalProperties: false,
  },
};
