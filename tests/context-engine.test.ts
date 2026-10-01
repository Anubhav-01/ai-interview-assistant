import { describe, it, expect } from "vitest";
import {
  buildConversationContext,
  buildCandidateContext,
  buildJobContext,
} from "@core/context-engine";
import { emptyResume, emptyJob, type QAPair } from "@core/shared/types";

const qa = (q: string, a: string): QAPair => ({
  question: q,
  answer: a,
  questionType: "GENERAL",
  timestamp: Date.now(),
});

describe("buildConversationContext", () => {
  it("returns placeholder for empty history", () => {
    expect(buildConversationContext([])).toContain("first question");
  });

  it("includes recent Q&A pairs", () => {
    const ctx = buildConversationContext([
      qa("Tell me about your project", "I built a chat app with React."),
      qa("What was the biggest challenge?", "Handling websockets reliably."),
    ]);
    expect(ctx).toContain("Tell me about your project");
    expect(ctx).toContain("chat app");
    expect(ctx).toContain("biggest challenge");
  });

  it("keeps only the most recent pairs (context trimming)", () => {
    const history = Array.from({ length: 12 }, (_, i) =>
      qa(`Question number ${i}`, `Answer number ${i}`)
    );
    const ctx = buildConversationContext(history);
    expect(ctx).not.toContain("Question number 0");
    expect(ctx).toContain("Question number 11");
  });

  it("enforces a character budget", () => {
    const history = Array.from({ length: 8 }, (_, i) =>
      qa(`Q${i} ${"x".repeat(300)}`, "y".repeat(3000))
    );
    const ctx = buildConversationContext(history);
    expect(ctx.length).toBeLessThan(4000);
  });

  it("supports follow-up questions by keeping the last answer fullest", () => {
    const history = [
      qa("Tell me about your final-year project", "I built an ML pipeline for X. ".repeat(10)),
    ];
    const ctx = buildConversationContext(history);
    expect(ctx).toContain("ML pipeline");
  });
});

describe("buildCandidateContext (resume grounding)", () => {
  const resume = {
    ...emptyResume(),
    name: "Asha Kumar",
    skills: ["React", "Node.js", "SQL", "Python"],
    projects: [
      "Chat App — real-time chat using React and websockets",
      "ML Classifier — image classification with PyTorch",
      "Portfolio site — static site with plain HTML",
    ],
    experience: ["Intern at Acme Corp — built REST APIs in Node.js"],
  };

  it("includes name and skills", () => {
    const ctx = buildCandidateContext(resume);
    expect(ctx).toContain("Asha Kumar");
    expect(ctx).toContain("React");
  });

  it("ranks relevant projects higher for the question", () => {
    const ctx = buildCandidateContext(resume, "Tell me about your machine learning project", []);
    const mlIndex = ctx.indexOf("ML Classifier");
    const portfolioIndex = ctx.indexOf("Portfolio site");
    expect(mlIndex).toBeGreaterThan(-1);
    // ML project should be listed before less relevant ones
    if (portfolioIndex !== -1) expect(mlIndex).toBeLessThan(portfolioIndex);
  });

  it("handles an empty resume gracefully", () => {
    expect(buildCandidateContext(emptyResume())).toContain("no resume");
  });
});

describe("buildJobContext", () => {
  it("handles empty job data", () => {
    expect(buildJobContext(emptyJob())).toContain("no job description");
  });

  it("includes role, skills and responsibilities compactly", () => {
    const ctx = buildJobContext({
      ...emptyJob(),
      title: "Backend Engineer",
      requiredSkills: ["Node.js", "SQL"],
      responsibilities: ["Build APIs", "Review code"],
      experience: "2+ years",
    });
    expect(ctx).toContain("Backend Engineer");
    expect(ctx).toContain("Node.js");
    expect(ctx).toContain("Build APIs");
    expect(ctx.length).toBeLessThan(1400);
  });
});
