import {
  deepCleanStrayEscapes,
  extractText,
  findToolUse,
  getAnthropicClient,
  runToolTurn,
  WEDDING_MODEL,
} from "../../../lib/anthropic-client.js";
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

  const client = getAnthropicClient();
  let response;
  try {
    response = await runToolTurn(client, {
      model: WEDDING_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildDecodeDocumentSystemPrompt(language, { extractedText }),
      tools: [DECODE_DOCUMENT_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: "Decode this document." }],
    });
  } catch (error) {
    console.error("decode-document Anthropic call failed", error);
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "refusal" }, { status: 422 });
  }

  const toolUse = findToolUse(response.content, [DECODE_DOCUMENT_TOOL.name]);
  if (!toolUse) {
    return Response.json({ error: "inconclusive", detail: extractText(response.content) }, { status: 422 });
  }

  const parsed = decodeDocumentSchema.safeParse(deepCleanStrayEscapes(toolUse.input));
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
