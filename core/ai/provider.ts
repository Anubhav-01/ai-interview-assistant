// ============================================================
// AIProvider abstraction. Providers are replaceable.
// ============================================================

import type { BuiltPrompt } from "../shared/types";

export interface AIGenerateOptions {
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  /** Whether this provider sends data to an external API. */
  readonly isExternal: boolean;
  generate(prompt: BuiltPrompt, opts?: AIGenerateOptions): Promise<string>;
}

export class AIProviderError extends Error {
  code:
    | "MISSING_API_KEY"
    | "INVALID_API_KEY"
    | "RATE_LIMIT"
    | "NETWORK"
    | "TIMEOUT"
    | "CANCELLED"
    | "BAD_RESPONSE"
    | "UNKNOWN";

  constructor(code: AIProviderError["code"], message: string) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
  }
}

/** fetch with timeout + user cancellation support */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 45000,
  userSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const onUserAbort = () => controller.abort(new Error("cancelled"));
  userSignal?.addEventListener("abort", onUserAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (userSignal?.aborted) throw new AIProviderError("CANCELLED", "Request cancelled.");
    if (controller.signal.aborted)
      throw new AIProviderError("TIMEOUT", "The AI request timed out. Please try again.");
    throw new AIProviderError(
      "NETWORK",
      "Network error - could not reach the AI provider. Check your internet connection."
    );
  } finally {
    clearTimeout(timer);
    userSignal?.removeEventListener("abort", onUserAbort);
  }
}

export function mapHttpError(status: number, body: string): AIProviderError {
  if (status === 401 || status === 403)
    return new AIProviderError(
      "INVALID_API_KEY",
      "The API key was rejected. Check it in Settings."
    );
  if (status === 429)
    return new AIProviderError(
      "RATE_LIMIT",
      "Rate limit reached on the AI provider. Wait a moment and try again."
    );
  return new AIProviderError(
    "BAD_RESPONSE",
    `AI provider returned HTTP ${status}: ${body.slice(0, 300)}`
  );
}
