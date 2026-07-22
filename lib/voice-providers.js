// Speech-to-text / text-to-speech provider for the voice-enabled Quick Verdict
// (Pipecat-inspired point-of-decision interaction - real STT/TTS provider APIs
// orchestrated around existing logic, not a literal Pipecat/Python dependency,
// which doesn't fit this app's serverless Next.js deployment). Plain fetch
// against OpenAI's audio endpoints - no new SDK dependency for a provider this
// app has no API key to actually exercise yet. Throws a clear "not_configured"
// error rather than pretending to work when OPENAI_API_KEY is absent - never
// silently returns fake audio or fake text.
const OPENAI_BASE_URL = "https://api.openai.com/v1";

function requireApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const error = new Error("voice_provider_not_configured");
    error.code = "not_configured";
    throw error;
  }
  return key;
}

// audioBuffer: the raw recorded clip (webm/opus from the browser's
// MediaRecorder). Returns the transcript text.
export async function transcribeAudio(audioBuffer, { mimeType = "audio/webm" } = {}) {
  const key = requireApiKey();
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType }), "clip.webm");
  form.append("model", "whisper-1");

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`transcription_failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.text;
}

// Returns an mp3 audio Buffer for the given text.
export async function synthesizeSpeech(text) {
  const key = requireApiKey();
  const response = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice: "alloy", input: text }),
  });
  if (!response.ok) {
    throw new Error(`speech_synthesis_failed: ${await response.text()}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
