import type { AppSettings } from "../shared/types";
import type { AIProvider } from "./provider";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";

export * from "./provider";
export { OpenAIProvider } from "./openai";
export { GeminiProvider } from "./gemini";
export { MockProvider } from "./mock";

/** Factory: create the AI provider selected in settings. */
export function createAIProvider(settings: AppSettings["ai"]): AIProvider {
  switch (settings.provider) {
    case "openai":
      return new OpenAIProvider(settings.openaiApiKey, settings.openaiModel || "gpt-4o-mini");
    case "gemini":
      return new GeminiProvider(settings.geminiApiKey, settings.geminiModel || "gemini-1.5-flash");
    case "mock":
    default:
      return new MockProvider();
  }
}
