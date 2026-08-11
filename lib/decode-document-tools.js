// Raw JSON Schema tool for "Decode This" - unlike every other domain's tool
// in this app, there is no lib/*-finance.js number computed before this call
// (the whole feature IS the AI reading real submitted text, not narrating a
// pre-computed figure). The grounding discipline this app uses everywhere
// else ("cite the actual numbers provided") becomes: every excerpt must be a
// real verbatim quote from the submitted document - checked server-side
// after the call (see lib/decode-document-validation.js's
// filterGroundedClauses), never just trusted.

export const DECODE_DOCUMENT_TOOL = {
  name: "decode_document",
  description:
    "Explain a real document (loan agreement, insurance PDS, tenancy agreement, offer letter) the customer uploaded, in plain language. This is NOT legal or financial advice. Every excerpt you cite MUST be an exact verbatim quote copied from the document text given to you - never paraphrase a quote or invent a clause that isn't actually in the text.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      documentType: {
        type: "string",
        enum: ["loan_agreement", "insurance_pds", "tenancy_agreement", "offer_letter", "other"],
        description: "Inferred from the document's actual content.",
      },
      plainLanguageSummary: {
        type: "string",
        description: "2-4 sentence plain-language summary of what this document actually says, grounded only in the real text given.",
      },
      flaggedClauses: {
        type: "array",
        description: "Only genuinely notable clauses (penalties, auto-renewal, rate changes, exclusions) - not routine boilerplate. Empty array if nothing is genuinely worth flagging.",
        items: {
          type: "object",
          properties: {
            excerpt: { type: "string", description: "Exact verbatim quote from the document - not a paraphrase." },
            concern: { type: "string", description: "Plain-language explanation of why this is worth the customer's attention." },
            severity: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["excerpt", "concern", "severity"],
          additionalProperties: false,
        },
      },
      keyFacts: {
        type: "array",
        description: "The most important concrete facts (amounts, dates, rates, durations) actually stated in the document.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            sourceExcerpt: { type: "string", description: "Exact verbatim quote the value was taken from." },
          },
          required: ["label", "value", "sourceExcerpt"],
          additionalProperties: false,
        },
      },
    },
    required: ["documentType", "plainLanguageSummary", "flaggedClauses", "keyFacts"],
    additionalProperties: false,
  },
};
