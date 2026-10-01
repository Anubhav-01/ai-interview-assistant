import { describe, it, expect, vi, afterEach } from "vitest";
import { MockProvider } from "@core/ai/mock";
import { OpenAIProvider } from "@core/ai/openai";
import { GeminiProvider } from "@core/ai/gemini";
import { AIProviderError, createAIProvider } from "@core/ai";
import { buildPrompt } from "@core/prompt-engine";
import { defaultSettings, type GenerateRequest } from "@core/shared/types";

const req: GenerateRequest = {
  question: "Write a function to reverse a string",
  questionType: "CODING",
  candidateContext: "Name: Test",
  jobContext: "",
  conversationContext: "",
  interviewType: "Coding",
  targetRole: "SDE",
  language: "English",
  answerLength: "Short",
};

afterEach(() => vi.restoreAllMocks());

describe("MockProvider", () => {
  it("generates a successful offline response", async () => {
    const provider = new MockProvider();
    const answer = await provider.generate(buildPrompt(req));
    expect(answer).toContain("Approach:");
    expect(answer).toContain("Time Complexity");
    expect(provider.isExternal).toBe(false);
  });

  it("answers SQL questions with a query", async () => {
    const provider = new MockProvider();
    const answer = await provider.generate(buildPrompt({ ...req, questionType: "SQL" }));
    expect(answer).toMatch(/SELECT/i);
  });
});

describe("OpenAIProvider", () => {
  it("fails clearly with a missing API key", async () => {
    const provider = new OpenAIProvider("");
    await expect(provider.generate(buildPrompt(req))).rejects.toMatchObject({
      code: "MISSING_API_KEY",
    });
  });

  it("returns text on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "Hello answer" } }] }), {
          status: 200,
        })
      )
    );
    const provider = new OpenAIProvider("sk-test");
    expect(await provider.generate(buildPrompt(req))).toBe("Hello answer");
  });

  it("maps 401 to INVALID_API_KEY", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
    const provider = new OpenAIProvider("sk-bad");
    await expect(provider.generate(buildPrompt(req))).rejects.toMatchObject({
      code: "INVALID_API_KEY",
    });
  });

  it("maps 429 to RATE_LIMIT", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("slow down", { status: 429 })));
    const provider = new OpenAIProvider("sk-test");
    await expect(provider.generate(buildPrompt(req))).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });
  });

  it("maps network failure to NETWORK error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const provider = new OpenAIProvider("sk-test");
    await expect(provider.generate(buildPrompt(req))).rejects.toMatchObject({
      code: "NETWORK",
    });
  });

  it("rejects malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ nope: true }), { status: 200 })));
    const provider = new OpenAIProvider("sk-test");
    await expect(provider.generate(buildPrompt(req))).rejects.toMatchObject({
      code: "BAD_RESPONSE",
    });
  });

  it("times out slow requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
      )
    );
    const provider = new OpenAIProvider("sk-test");
    await expect(
      provider.generate(buildPrompt(req), { timeoutMs: 50 })
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("supports user cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
      )
    );
    const provider = new OpenAIProvider("sk-test");
    const controller = new AbortController();
    const pending = provider.generate(buildPrompt(req), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
  });
});

describe("GeminiProvider", () => {
  it("fails clearly with a missing API key", async () => {
    const provider = new GeminiProvider("");
    await expect(provider.generate(buildPrompt(req))).rejects.toBeInstanceOf(AIProviderError);
  });

  it("parses a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini answer" }] } }] }),
          { status: 200 }
        )
      )
    );
    const provider = new GeminiProvider("AIza-test");
    expect(await provider.generate(buildPrompt(req))).toBe("Gemini answer");
  });
});

describe("createAIProvider factory", () => {
  it("creates the provider matching settings", () => {
    const s = defaultSettings().ai;
    expect(createAIProvider({ ...s, provider: "mock" }).id).toBe("mock");
    expect(createAIProvider({ ...s, provider: "openai" }).id).toBe("openai");
    expect(createAIProvider({ ...s, provider: "gemini" }).id).toBe("gemini");
  });
});
