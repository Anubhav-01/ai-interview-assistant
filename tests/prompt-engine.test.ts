import { describe, it, expect } from "vitest";
import { buildPrompt } from "@core/prompt-engine";
import type { GenerateRequest } from "@core/shared/types";

const base: GenerateRequest = {
  question: "What is a closure?",
  questionType: "TECHNICAL",
  candidateContext: "Name: Test User\nSkills: JavaScript",
  jobContext: "Role: Frontend Dev",
  conversationContext: "(none)",
  interviewType: "Technical",
  targetRole: "Frontend Developer",
  language: "English",
  answerLength: "Short",
};

describe("buildPrompt", () => {
  it("embeds all context blocks", () => {
    const p = buildPrompt(base);
    expect(p.user).toContain("Candidate Context:");
    expect(p.user).toContain("Test User");
    expect(p.user).toContain("Frontend Dev");
    expect(p.user).toContain("What is a closure?");
    expect(p.user).toContain("Question Type: TECHNICAL");
  });

  it("forbids inventing information (grounding rules)", () => {
    const p = buildPrompt(base);
    expect(p.system).toMatch(/NEVER invent/i);
    expect(p.system).toMatch(/verified candidate information/i);
  });

  it("uses HR guidance for HR questions", () => {
    const p = buildPrompt({ ...base, questionType: "HR", question: "Why should we hire you?" });
    expect(p.user).toMatch(/HR question/i);
    expect(p.user).toMatch(/avoid corporate buzzwords/i);
  });

  it("uses STAR guidance for behavioral questions without printing headings", () => {
    const p = buildPrompt({ ...base, questionType: "BEHAVIORAL" });
    expect(p.user).toContain("Situation -> Task -> Action -> Result");
    expect(p.user).toMatch(/do NOT print those headings/i);
  });

  it("requests approach/code/complexity format for coding questions", () => {
    const p = buildPrompt({ ...base, questionType: "CODING" });
    expect(p.user).toContain("Approach:");
    expect(p.user).toContain("Time Complexity");
    expect(p.user).toContain("Space Complexity");
  });

  it("requests query + explanation format for SQL questions", () => {
    const p = buildPrompt({ ...base, questionType: "SQL" });
    expect(p.user).toContain("SQL Query:");
    expect(p.user).toContain("Explanation:");
  });

  it("instructs use of previous context for follow-ups", () => {
    const p = buildPrompt({ ...base, questionType: "FOLLOW_UP" });
    expect(p.user).toMatch(/FOLLOW-UP/i);
    expect(p.user).toMatch(/Recent Interview Context/);
  });

  it("respects language and answer length settings", () => {
    const p = buildPrompt({ ...base, language: "Hinglish", answerLength: "Very Short" });
    expect(p.system).toMatch(/Hinglish/);
    expect(p.system).toMatch(/1-2 sentences/);
  });

  it("adds modifier instructions", () => {
    expect(buildPrompt({ ...base, modifier: "shorter" }).user).toMatch(/SHORTER/);
    expect(buildPrompt({ ...base, modifier: "simpler" }).user).toMatch(/SIMPLER/);
    expect(buildPrompt({ ...base, modifier: "regenerate" }).user).toMatch(/fresh alternative/i);
  });
});
