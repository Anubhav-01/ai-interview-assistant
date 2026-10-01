// ============================================================
// Speech IPC: Whisper transcription of audio segments recorded
// in the renderer. Only invoked while the user has listening
// turned on and the Whisper provider selected.
// ============================================================

import { ipcMain } from "electron";
import { transcribeWithWhisper } from "../../core/speech/whisper";
import { loadSettings } from "./settings";
import type { TranscriptionResult } from "../../core/speech/provider";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB per segment

export function registerSpeechHandlers() {
  ipcMain.handle(
    "speech:transcribe",
    async (_evt, audio: unknown, mimeType: unknown): Promise<TranscriptionResult> => {
      if (!(audio instanceof Uint8Array) && !(audio instanceof ArrayBuffer)) {
        return { ok: false, error: "Invalid audio payload." };
      }
      const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
      if (bytes.byteLength > MAX_AUDIO_BYTES) {
        return { ok: false, error: "Audio segment too large." };
      }
      const mime = typeof mimeType === "string" ? mimeType.slice(0, 100) : "audio/webm";

      const settings = loadSettings();
      return transcribeWithWhisper(
        bytes,
        mime,
        settings.speech.language,
        settings.ai.openaiApiKey
      );
    }
  );
}
