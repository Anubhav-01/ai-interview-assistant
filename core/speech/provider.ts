// ============================================================
// SpeechProvider abstraction.
//
// - WhisperProvider: audio recorded in the renderer is sent via
//   IPC to the main process, which calls the OpenAI Whisper API.
// - BrowserSpeechProvider: uses the Web Speech API in the
//   renderer where available.
// - MockSpeechProvider: emits sample questions offline.
//
// The renderer-side capture implementations live in
// src/hooks/useSpeech.ts; this file defines shared contracts.
// ============================================================

export interface TranscriptionResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface SpeechProviderInfo {
  id: "whisper" | "browser" | "mock";
  label: string;
  isExternal: boolean;
  description: string;
}

export const SPEECH_PROVIDERS: SpeechProviderInfo[] = [
  {
    id: "whisper",
    label: "OpenAI Whisper (accurate)",
    isExternal: true,
    description:
      "Records microphone audio locally and sends completed phrases to the OpenAI Whisper API for transcription. Requires an OpenAI API key.",
  },
  {
    id: "browser",
    label: "Browser speech recognition",
    isExternal: true,
    description:
      "Uses the built-in Web Speech API. May not be available in all Electron builds; falls back gracefully.",
  },
  {
    id: "mock",
    label: "Mock (offline demo)",
    isExternal: false,
    description: "Emits sample interview questions for testing without a microphone or API key.",
  },
];

export const MOCK_QUESTIONS: string[] = [
  "Tell me about yourself.",
  "What is your strongest project? Walk me through it.",
  "What was the biggest challenge in that project?",
  "What is the difference between an abstract class and an interface?",
  "Write a function to reverse a string.",
  "Write a SQL query to find the second highest salary from the employees table.",
  "Why should we hire you?",
  "Where do you see yourself in five years?",
];
