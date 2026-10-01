// ============================================================
// AI IPC: builds the prompt in the main process and calls the
// configured provider. Supports cancellation (emergency stop).
// ============================================================

import { ipcMain } from "electron";
import { buildPrompt } from "../../core/prompt-engine";
import { createAIProvider, AIProviderError } from "../../core/ai";
import { loadSettings } from "./settings";
import type {
  GenerateRequest,
  GenerateResult,
  QuestionType,
  InterviewType,
  Language,
  AnswerLength,
} from "../../core/shared/types";

let activeController: AbortController | null = null;

const QUESTION_TYPES: QuestionType[] = [
  "INTRODUCTION", "HR", "BEHAVIORAL", "TECHNICAL", "CODING", "SQL",
  "PROJECT", "RESUME", "SYSTEM_DESIGN", "FOLLOW_UP", "GENERAL",
];
const INTERVIEW_TYPES: InterviewType[] = [
  "HR", "Behavioral", "Technical", "Coding", "SQL", "System Design", "General", "Mixed",
];
const LANGUAGES: Language[] = ["English", "Hindi", "Hinglish"];
const LENGTHS: AnswerLength[] = ["Very Short", "Short", "Medium", "Detailed"];

function sanitizeRequest(input: unknown): GenerateRequest | null {
  const r = input as any;
  if (!r || typeof r !== "object") return null;
  if (typeof r.question !== "string" || !r.question.trim()) return null;

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const oneOf = <T extends string>(v: unknown, opts: T[], fb: T): T =>
    typeof v === "string" && (opts as string[]).includes(v) ? (v as T) : fb;

  return {
    question: r.question.slice(0, 2000).trim(),
    questionType: oneOf(r.questionType, QUESTION_TYPES, "GENERAL"),
    candidateContext: str(r.candidateContext, 6000),
    jobContext: str(r.jobContext, 3000),
    conversationContext: str(r.conversationContext, 6000),
    interviewType: oneOf(r.interviewType, INTERVIEW_TYPES, "Mixed"),
    targetRole: str(r.targetRole, 120),
    language: oneOf(r.language, LANGUAGES, "English"),
    answerLength: oneOf(r.answerLength, LENGTHS, "Short"),
    modifier: ["regenerate", "shorter", "simpler"].includes(r.modifier)
      ? r.modifier
      : undefined,
  };
}

export function registerAIHandlers() {
  ipcMain.handle("ai:generate", async (_evt, rawReq: unknown): Promise<GenerateResult> => {
    const req = sanitizeRequest(rawReq);
    if (!req) return { ok: false, error: "Empty or invalid question." };

    // Cancel any in-flight request first (one at a time keeps things simple).
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    try {
      const settings = loadSettings();
      const provider = createAIProvider(settings.ai);
      const prompt = buildPrompt(req);
      const answer = await provider.generate(prompt, {
        temperature: settings.ai.temperature,
        signal: controller.signal,
        timeoutMs: 60000,
      });
      if (controller.signal.aborted) return { ok: false, error: "Cancelled." };
      return { ok: true, answer };
    } catch (err: any) {
      if (err instanceof AIProviderError) {
        return { ok: false, error: err.message };
      }
      return { ok: false, error: `Unexpected AI error: ${err?.message ?? String(err)}` };
    } finally {
      if (activeController === controller) activeController = null;
    }
  });

  ipcMain.handle("ai:cancel", async () => {
    activeController?.abort();
    activeController = null;
    return { ok: true };
  });

  // Tells the UI which provider is active and whether it's external
  ipcMain.handle("ai:providerInfo", async () => {
    const settings = loadSettings();
    const provider = createAIProvider(settings.ai);
    return {
      id: provider.id,
      label: provider.label,
      isExternal: provider.isExternal,
      hasKey:
        provider.id === "mock" ||
        (provider.id === "openai" && !!settings.ai.openaiApiKey) ||
        (provider.id === "gemini" && !!settings.ai.geminiApiKey),
    };
  });
}

export function cancelActiveAIRequest() {
  activeController?.abort();
  activeController = null;
}
