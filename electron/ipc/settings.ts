// ============================================================
// Local settings store (JSON in the app's data directory).
// API keys are stored locally only and never leave the machine
// except when calling the AI provider the user configured.
// .env values act as fallbacks for empty fields.
// ============================================================

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  AppSettings,
  defaultSettings,
  AIProviderId,
  SpeechProviderId,
} from "../../core/shared/types";

export function getDataDir(): string {
  // Dev: keep data inside the project for easy inspection.
  // Packaged: use the standard per-user app data location.
  const base = app.isPackaged
    ? path.join(app.getPath("userData"), "data")
    : path.join(app.getAppPath(), "data");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function settingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}

let cached: AppSettings | null = null;

export function loadSettings(): AppSettings {
  if (cached) return cached;
  const defaults = defaultSettings();
  let stored: Partial<AppSettings> = {};
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    stored = JSON.parse(raw);
  } catch {
    /* first run - use defaults */
  }

  const merged: AppSettings = {
    ai: { ...defaults.ai, ...(stored.ai ?? {}) },
    speech: { ...defaults.speech, ...(stored.speech ?? {}) },
    appearance: { ...defaults.appearance, ...(stored.appearance ?? {}) },
    shortcuts: { ...defaults.shortcuts, ...(stored.shortcuts ?? {}) },
  };

  applyEnvFallbacks(merged, stored);
  cached = merged;
  return merged;
}

/** .env fills fields the user hasn't set in the app. */
function applyEnvFallbacks(s: AppSettings, stored: Partial<AppSettings>) {
  const env = process.env;
  if (!s.ai.openaiApiKey && env.OPENAI_API_KEY) s.ai.openaiApiKey = env.OPENAI_API_KEY;
  if (!s.ai.geminiApiKey && env.GEMINI_API_KEY) s.ai.geminiApiKey = env.GEMINI_API_KEY;
  if (env.OPENAI_MODEL && !stored.ai?.openaiModel) s.ai.openaiModel = env.OPENAI_MODEL;
  if (env.GEMINI_MODEL && !stored.ai?.geminiModel) s.ai.geminiModel = env.GEMINI_MODEL;
  const envProvider = (env.AI_PROVIDER || "").toLowerCase();
  if (!stored.ai?.provider && ["openai", "gemini", "mock"].includes(envProvider)) {
    s.ai.provider = envProvider as AIProviderId;
  }
  const envSpeech = (env.SPEECH_PROVIDER || "").toLowerCase();
  if (!stored.speech?.provider && ["whisper", "browser", "mock"].includes(envSpeech)) {
    s.speech.provider = envSpeech as SpeechProviderId;
  }
}

export function saveSettings(next: AppSettings): AppSettings {
  const validated = validateSettings(next);
  cached = validated;
  fs.writeFileSync(settingsPath(), JSON.stringify(validated, null, 2), "utf8");
  return validated;
}

/** Validate/sanitize IPC input - never trust the renderer blindly. */
export function validateSettings(input: unknown): AppSettings {
  const d = defaultSettings();
  const s = (typeof input === "object" && input !== null ? input : {}) as any;

  const str = (v: unknown, fallback: string, max = 300): string =>
    typeof v === "string" ? v.slice(0, max) : fallback;
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;

  return {
    ai: {
      provider: oneOf(s.ai?.provider, ["openai", "gemini", "mock"] as const, d.ai.provider),
      openaiApiKey: str(s.ai?.openaiApiKey, d.ai.openaiApiKey),
      openaiModel: str(s.ai?.openaiModel, d.ai.openaiModel, 80) || d.ai.openaiModel,
      geminiApiKey: str(s.ai?.geminiApiKey, d.ai.geminiApiKey),
      geminiModel: str(s.ai?.geminiModel, d.ai.geminiModel, 80) || d.ai.geminiModel,
      temperature: num(s.ai?.temperature, d.ai.temperature, 0, 2),
    },
    speech: {
      provider: oneOf(s.speech?.provider, ["whisper", "browser", "mock"] as const, d.speech.provider),
      language: oneOf(s.speech?.language, ["English", "Hindi", "Hinglish"] as const, d.speech.language),
    },
    appearance: {
      theme: oneOf(s.appearance?.theme, ["dark", "light"] as const, d.appearance.theme),
      fontSize: num(s.appearance?.fontSize, d.appearance.fontSize, 12, 22),
      opacity: num(s.appearance?.opacity, d.appearance.opacity, 0.4, 1),
    },
    shortcuts: {
      toggleListening: str(s.shortcuts?.toggleListening, d.shortcuts.toggleListening, 60),
      toggleWindow: str(s.shortcuts?.toggleWindow, d.shortcuts.toggleWindow, 60),
      regenerate: str(s.shortcuts?.regenerate, d.shortcuts.regenerate, 60),
      copy: str(s.shortcuts?.copy, d.shortcuts.copy, 60),
    },
  };
}
