// ============================================================
// WhisperProvider (main-process side).
// Sends a finished audio segment to the OpenAI Whisper API.
// Only called when the user has explicitly started listening
// and selected the Whisper provider.
// ============================================================

import type { Language } from "../shared/types";
import type { TranscriptionResult } from "./provider";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

const LANGUAGE_CODES: Record<Language, string | undefined> = {
  English: "en",
  Hindi: "hi",
  Hinglish: undefined, // let Whisper auto-detect mixed speech
};

export async function transcribeWithWhisper(
  audio: Uint8Array,
  mimeType: string,
  language: Language,
  apiKey: string,
  timeoutMs = 30000
): Promise<TranscriptionResult> {
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Whisper needs an OpenAI API key. Add one in Settings, or switch the speech provider to Mock.",
    };
  }
  if (!audio || audio.byteLength < 1000) {
    return { ok: false, error: "Audio segment too short to transcribe." };
  }

  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  // Copy into a fresh ArrayBuffer to satisfy Blob typing across contexts.
  const buf = new Uint8Array(audio).buffer as ArrayBuffer;
  form.append("file", new Blob([buf], { type: mimeType }), `segment.${ext}`);
  form.append("model", "whisper-1");
  const lang = LANGUAGE_CODES[language];
  if (lang) form.append("language", lang);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401)
        return { ok: false, error: "OpenAI rejected the API key (Whisper). Check Settings." };
      if (res.status === 429)
        return { ok: false, error: "Whisper rate limit reached. Try again shortly." };
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Whisper error HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data: any = await res.json().catch(() => null);
    if (typeof data?.text !== "string") {
      return { ok: false, error: "Whisper returned a malformed response." };
    }
    return { ok: true, text: data.text.trim() };
  } catch (err: any) {
    if (controller.signal.aborted) return { ok: false, error: "Whisper request timed out." };
    return { ok: false, error: "Network error while reaching the Whisper API." };
  } finally {
    clearTimeout(timer);
  }
}
