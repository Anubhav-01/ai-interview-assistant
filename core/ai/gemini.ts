import type { BuiltPrompt } from "../shared/types";
import {
  AIProvider,
  AIGenerateOptions,
  AIProviderError,
  fetchWithTimeout,
  mapHttpError,
} from "./provider";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini";
  readonly isExternal = true;

  constructor(
    private apiKey: string,
    private model = "gemini-1.5-flash",
    private baseUrl = "https://generativelanguage.googleapis.com/v1beta"
  ) {}

  async generate(prompt: BuiltPrompt, opts: AIGenerateOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new AIProviderError(
        "MISSING_API_KEY",
        "No Gemini API key configured. Add it in Settings (or .env)."
      );
    }

    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`;

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: "user", parts: [{ text: prompt.user }] }],
          generationConfig: { temperature: opts.temperature ?? 0.6 },
        }),
      },
      opts.timeoutMs ?? 45000,
      opts.signal
    );

    if (!res.ok) {
      throw mapHttpError(res.status, await res.text().catch(() => ""));
    }

    const data: any = await res.json().catch(() => null);
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("");
    if (typeof text !== "string" || !text.trim()) {
      throw new AIProviderError("BAD_RESPONSE", "Gemini returned an empty or malformed response.");
    }
    return text.trim();
  }
}
