import type { BuiltPrompt } from "../shared/types";
import {
  AIProvider,
  AIGenerateOptions,
  AIProviderError,
  fetchWithTimeout,
  mapHttpError,
} from "./provider";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly label = "OpenAI";
  readonly isExternal = true;

  constructor(
    private apiKey: string,
    private model = "gpt-4o-mini",
    private baseUrl = "https://api.openai.com/v1"
  ) {}

  async generate(prompt: BuiltPrompt, opts: AIGenerateOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new AIProviderError(
        "MISSING_API_KEY",
        "No OpenAI API key configured. Add it in Settings (or .env)."
      );
    }

    const res = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: opts.temperature ?? 0.6,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        }),
      },
      opts.timeoutMs ?? 45000,
      opts.signal
    );

    if (!res.ok) {
      throw mapHttpError(res.status, await res.text().catch(() => ""));
    }

    const data: any = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new AIProviderError("BAD_RESPONSE", "OpenAI returned an empty or malformed response.");
    }
    return text.trim();
  }
}
