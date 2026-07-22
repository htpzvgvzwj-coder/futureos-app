import { getCurrentUserId } from "../../../../../lib/auth.js";
import { synthesizeSpeech } from "../../../../../lib/voice-providers.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// Speaks Guardian's verdict narrative back - the whole point of a
// point-of-decision tool being usable while your hands/eyes are busy
// negotiating, not just typed input with a text answer.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  if (typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "missing_text" }, { status: 400 });
  }

  try {
    const audioBuffer = await synthesizeSpeech(body.text);
    return new Response(audioBuffer, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (error) {
    if (error.code === "not_configured") {
      return Response.json({ error: "voice_not_configured" }, { status: 503 });
    }
    console.error("decision/voice/speak failed", error);
    return Response.json({ error: "speech_synthesis_failed" }, { status: 502 });
  }
}
