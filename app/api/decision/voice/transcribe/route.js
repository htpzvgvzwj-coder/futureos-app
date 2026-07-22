import { getCurrentUserId } from "../../../../../lib/auth.js";
import { transcribeAudio } from "../../../../../lib/voice-providers.js";
import { extractAmountFromTranscript } from "../../../../../lib/voice-amount-extractor.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// Point-of-decision voice input: transcribes what the customer said, and
// deterministically (not via AI) extracts a candidate amount - always returned
// as an editable suggestion, never auto-submitted, so a misheard number can't
// silently drive the verdict in lib/decision-finance.js.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  if (typeof body.audioBase64 !== "string" || !body.audioBase64) {
    return Response.json({ error: "missing_audio" }, { status: 400 });
  }

  try {
    const audioBuffer = Buffer.from(body.audioBase64, "base64");
    const transcript = await transcribeAudio(audioBuffer, { mimeType: body.mimeType });
    return Response.json({ transcript, detectedAmount: extractAmountFromTranscript(transcript) });
  } catch (error) {
    if (error.code === "not_configured") {
      return Response.json({ error: "voice_not_configured" }, { status: 503 });
    }
    console.error("decision/voice/transcribe failed", error);
    return Response.json({ error: "transcription_failed" }, { status: 502 });
  }
}
