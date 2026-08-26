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
      bullRebuttal: {
        type: "string",
        description:
          "Bull's direct response to the SPECIFIC risk named in bearCase, grounded in the real numbers provided - not a restatement of bullCase, and not a dodge of the risk.",
      },
      judgeSynthesis: {
        type: "string",
        description:
          "A balanced final verdict weighing bullCase + bullRebuttal against bearCase, in plain language the customer can act on. May side with either case.",
      },
      recommendedAction: {
        type: "string",
        enum: ["proceed", "proceed_with_adjustment", "wait", "reconsider"],
      },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: ["bullCase", "bearCase", "bearRiskTag", "bullRebuttal", "judgeSynthesis", "recommendedAction", "confidence"],
    additionalProperties: false,
  },
};

// Joint Debate v2's real second-side step (lib/joint-debate-context.js) -
// called ONLY after the real designated partner has submitted their own
// real rebuttal (app/api/mirror/debate/[id]/partner-respond/route.js), never
// at the original debate's generation time. Explicitly weighs the two real
// people's actual words - the original bull/bear/judge, unchanged, plus
// whatever the partner genuinely just said - never a restatement of one
// side alone.
export const JOINT_SYNTHESIS_TOOL = {
  name: "joint_synthesis",
  description:
    "Given an already-completed Bull/Bear/Judge debate and a real response the customer's partner just submitted, write a joint synthesis that explicitly weighs both real people's actual positions. Do not invent any dollar figure or score - none are needed here, only real text already provided.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      jointSynthesis: {
        type: "string",
        description:
          "A synthesis that explicitly names what the initiating customer's situation was and what the partner's real response said, then gives a joint recommendation weighing both - never silent about either side, never inventing a third position neither party actually expressed.",
      },
      alignment: {
        type: "string",
        enum: ["aligned", "diverged"],
        description: "Whether the partner's real response agrees with the original debate's direction (aligned) or genuinely pushes back on it (diverged).",
      },
    },
    required: ["jointSynthesis", "alignment"],
    additionalProperties: false,
  },
};
