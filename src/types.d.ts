import type {
  AppSettings,
  GenerateRequest,
  GenerateResult,
  ResumeData,
  SessionData,
} from "@core/shared/types";
import type { TranscriptionResult } from "@core/speech/provider";

export interface ResumeParseResult {
  ok: boolean;
  data?: ResumeData;
  rawText?: string;
  fileName?: string;
  error?: string;
}

export interface ProviderInfo {
  id: string;
  label: string;
  isExternal: boolean;
  hasKey: boolean;
}

export interface WindowStateInfo {
  alwaysOnTop: boolean;
  compact: boolean;
  opacity: number;
}

export type ShortcutAction = "toggleListening" | "toggleWindow" | "regenerate" | "copy";

declare global {
  interface Window {
    api: {
      settings: {
        get(): Promise<AppSettings>;
        set(s: AppSettings): Promise<{ ok: boolean; settings?: AppSettings; error?: string }>;
      };
      resume: {
        openAndParse(): Promise<ResumeParseResult>;
        parseText(text: string): Promise<ResumeParseResult>;
      };
      ai: {
        generate(req: GenerateRequest): Promise<GenerateResult>;
        cancel(): Promise<{ ok: boolean }>;
        providerInfo(): Promise<ProviderInfo>;
      };
      speech: {
        transcribe(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult>;
      };
      sessions: {
        list(): Promise<SessionData[]>;
        save(session: SessionData): Promise<{ ok: boolean; error?: string }>;
        remove(id: string): Promise<{ ok: boolean; error?: string }>;
        exportSession(id: string): Promise<{ ok: boolean; path?: string; error?: string }>;
      };
      win: {
        minimize(): Promise<void>;
        close(): Promise<void>;
        setAlwaysOnTop(v: boolean): Promise<boolean>;
        setOpacity(v: number): Promise<void>;
        setCompact(v: boolean): Promise<boolean>;
        getState(): Promise<WindowStateInfo>;
      };
      clipboard: { write(text: string): Promise<{ ok: boolean }> };
      onShortcut(cb: (action: ShortcutAction) => void): () => void;
    };
  }
}

export {};
