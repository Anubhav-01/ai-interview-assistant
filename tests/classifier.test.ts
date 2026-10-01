import { describe, it, expect } from "vitest";
import { classifyQuestion, isLikelyQuestion } from "@core/classifier";

describe("classifyQuestion", () => {
  it("detects introduction questions", () => {
    expect(classifyQuestion("Tell me about yourself.")).toBe("INTRODUCTION");
    expect(classifyQuestion("Please introduce yourself")).toBe("INTRODUCTION");
    expect(classifyQuestion("Walk me through your resume")).toBe("INTRODUCTION");
  });

  it("detects HR questions", () => {
    expect(classifyQuestion("Why should we hire you?")).toBe("HR");
    expect(classifyQuestion("What are your strengths?")).toBe("HR");
    expect(classifyQuestion("Where do you see yourself in five years?")).toBe("HR");
    expect(classifyQuestion("Why should we hire a fresher?")).toBe("HR");
  });

  it("detects behavioral questions", () => {
    expect(classifyQuestion("Tell me about a time you faced a conflict in a team.")).toBe("BEHAVIORAL");
    expect(classifyQuestion("Describe a situation where you missed a deadline")).toBe("BEHAVIORAL");
  });

  it("detects coding questions", () => {
    expect(classifyQuestion("Write a function to reverse a string")).toBe("CODING");
    expect(classifyQuestion("What is the time complexity of binary search?")).toBe("CODING");
    expect(classifyQuestion("Implement a linked list in Java")).toBe("CODING");
  });

  it("detects SQL questions", () => {
    expect(classifyQuestion("Write a SQL query to find the second highest salary")).toBe("SQL");
    expect(classifyQuestion("What is the difference between INNER JOIN and LEFT JOIN?")).toBe("SQL");
    expect(classifyQuestion("Explain window functions")).toBe("SQL");
  });

  it("detects system design questions", () => {
    expect(classifyQuestion("How would you design a URL shortener?")).toBe("SYSTEM_DESIGN");
    expect(classifyQuestion("Design a scalable notification system")).toBe("SYSTEM_DESIGN");
  });

  it("detects project questions", () => {
    expect(classifyQuestion("Tell me about your final-year project")).toBe("PROJECT");
    expect(classifyQuestion("What is your strongest project?")).toBe("PROJECT");
  });

  it("detects technical questions", () => {
    expect(classifyQuestion("What is the difference between abstract class and interface?")).toBe("TECHNICAL");
    expect(classifyQuestion("Explain how HTTP works")).toBe("TECHNICAL");
  });

  it("detects follow-up questions only when history exists", () => {
    expect(classifyQuestion("What was the biggest challenge?", true)).toBe("FOLLOW_UP");
    expect(classifyQuestion("Can you elaborate on that?", true)).toBe("FOLLOW_UP");
    expect(classifyQuestion("Tell me more", true)).toBe("FOLLOW_UP");
    // without history, no follow-up classification
    expect(classifyQuestion("Can you elaborate on that?", false)).not.toBe("FOLLOW_UP");
  });

  it("falls back to GENERAL for empty/unknown input", () => {
    expect(classifyQuestion("")).toBe("GENERAL");
    expect(classifyQuestion("The weather is nice today")).toBe("GENERAL");
  });
});

describe("isLikelyQuestion", () => {
  it("accepts real questions", () => {
    expect(isLikelyQuestion("What is polymorphism?")).toBe(true);
    expect(isLikelyQuestion("Tell me about yourself")).toBe(true);
    expect(isLikelyQuestion("Can you explain closures in JavaScript")).toBe(true);
  });

  it("rejects noise and fragments", () => {
    expect(isLikelyQuestion("")).toBe(false);
    expect(isLikelyQuestion("um")).toBe(false);
    expect(isLikelyQuestion("ok")).toBe(false);
    expect(isLikelyQuestion("yeah sure")).toBe(false);
  });
});
