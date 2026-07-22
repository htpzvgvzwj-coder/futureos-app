// Raw JSON Schema tool definition sent to the Claude API for the Future
// Mirror debate. Unlike a single confident recommendation, this forces the
// model to argue both sides before a judge's synthesis - the dollar figures
// and score are computed server-side (lib/mirror-finance.js) and never
// trusted from the model, same discipline as lib/hardship-tools.js.

export const FUTURE_MIRROR_DEBATE_TOOL = {
  name: "future_mirror_debate",
  description:
    "Argue both sides of whether the customer's stated plan is a good idea, then give a judge's synthesis, using ONLY the real computed feasibility numbers provided in this prompt. Do not invent any dollar figure or score - the app overwrites the future score and risk level from real computed data regardless of what you output here.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      bullCase: {
        type: "string",
        description: "The strongest honest case FOR this plan, grounded in the real numbers provided.",
      },
      bearCase: {
        type: "string",
        description:
          "The strongest honest case AGAINST this plan - a SPECIFIC concrete risk (not a generic disclaimer) grounded in the real numbers provided.",
      },
      bearRiskTag: {
        type: "string",
        enum: ["income_disruption", "rate_increase", "expense_shock", "timeline_slip", "market_downturn", "other"],
        description: "Short machine-readable tag for the bear case's core risk, so it can be tracked and checked against reality later.",
      },
      judgeSynthesis: {
        type: "string",
        description: "A balanced final verdict weighing both cases, in plain language the customer can act on. May side with either case.",
      },
      recommendedAction: {
        type: "string",
        enum: ["proceed", "proceed_with_adjustment", "wait", "reconsider"],
      },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: ["bullCase", "bearCase", "bearRiskTag", "judgeSynthesis", "recommendedAction", "confidence"],
    additionalProperties: false,
  },
};
