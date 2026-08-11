import { z } from "zod";

export const decodeDocumentRequestSchema = z.object({
  extractedText: z.string().min(1).max(20000),
  language: z.string().optional(),
});

const flaggedClauseSchema = z.object({
  excerpt: z.string().min(1),
  concern: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
});

const keyFactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  sourceExcerpt: z.string().min(1),
});

export const decodeDocumentSchema = z.object({
  documentType: z.enum(["loan_agreement", "insurance_pds", "tenancy_agreement", "offer_letter", "other"]),
  plainLanguageSummary: z.string().min(1),
  flaggedClauses: z.array(flaggedClauseSchema).max(8),
  keyFacts: z.array(keyFactSchema).max(10),
});

// Server-side grounding check, not just trusting the model's claim of a
// verbatim quote (same "verify, don't just trust the AI" discipline as
// app.js's validateToolCall() pattern in the sibling Compass project) -
// drops any clause/fact whose "excerpt" doesn't actually appear in the real
// submitted text, rather than showing the customer a fabricated quote from
// their own document. Whitespace is normalized before comparing since the
// model may reproduce a quote with slightly different spacing than pdf.js's
// raw text-item extraction.
function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function filterGroundedClauses(parsedData, extractedText) {
  const normalizedSource = normalizeWhitespace(extractedText);
  const isGrounded = (excerpt) => normalizedSource.includes(normalizeWhitespace(excerpt));

  return {
    ...parsedData,
    flaggedClauses: parsedData.flaggedClauses.filter((clause) => isGrounded(clause.excerpt)),
    keyFacts: parsedData.keyFacts.filter((fact) => isGrounded(fact.sourceExcerpt)),
  };
}
