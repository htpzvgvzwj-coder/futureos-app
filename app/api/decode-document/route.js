import { runToolTurnWithFallback } from "../../../lib/ai-fallback.js";
import { buildDecodeDocumentSystemPrompt } from "../../../lib/decode-document-prompts.js";
import { DECODE_DOCUMENT_TOOL } from "../../../lib/decode-document-tools.js";
import { decodeDocumentRequestSchema, decodeDocumentSchema, filterGroundedClauses } from "../../../lib/decode-document-validation.js";
import { saveReview } from "../../../lib/decode-document-store.js";
import { getCurrentUserId } from "../../../lib/auth.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsedRequest = decodeDocumentRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return Response.json({ error: "validation_failed", detail: parsedRequest.error.issues }, { status: 422 });
  }
  const { extractedText, language } = parsedRequest.data;

  let result;
  try {
    result = await runToolTurnWithFallback({
      systemPrompt: buildDecodeDocumentSystemPrompt(language, { extractedText }),
      tool: DECODE_DOCUMENT_TOOL,
      userMessage: "Decode this document.",
    });
  } catch (error) {
    console.error("decode-document: all configured AI providers failed", error.attempts ?? error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (result.refusal) {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  if (!result.toolInput) {
    return Response.json({ error: "inconclusive", detail: result.rawText }, { status: 422 });
  }

  const parsed = decodeDocumentSchema.safeParse(result.toolInput);
  if (!parsed.success) {
    console.error("decode-document tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  // Never show the customer a "quote" from their own document that isn't
  // actually in the text they submitted - verify, don't just trust the
  // model's claim of a verbatim excerpt.
  const grounded = filterGroundedClauses(parsed.data, extractedText);

  const saved = await saveReview(userId, {
    documentType: grounded.documentType,
    extractedText,
    summary: grounded.plainLanguageSummary,
    flaggedClauses: grounded.flaggedClauses,
    keyFacts: grounded.keyFacts,
  });

  return Response.json({
    id: saved.id,
    createdAt: saved.createdAt,
    documentType: grounded.documentType,
    summary: grounded.plainLanguageSummary,
    flaggedClauses: grounded.flaggedClauses,
    keyFacts: grounded.keyFacts,
  });
}
