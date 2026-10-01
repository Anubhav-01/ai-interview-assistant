import { describe, it, expect } from "vitest";
import { parseResumeText } from "@core/resume-parser";

const SAMPLE_RESUME = `
ANUBHAV SHARMA
anubhav@example.com | +91 9999999999

SUMMARY
Computer Science graduate passionate about full-stack development.

EDUCATION
B.Tech in Computer Science, IIT Delhi, 2021 - 2025, CGPA 8.7

TECHNICAL SKILLS
Languages: Python, JavaScript, TypeScript, SQL
Frameworks: React, Node.js, Express
Tools: Git, Docker

PROJECTS
Chat Application (React, Node.js)
- Built a real-time chat app supporting 500 concurrent users
- Implemented websocket reconnection logic

Resume Ranker (Python)
- NLP tool that ranks resumes against a job description

EXPERIENCE
Software Intern, Acme Corp — Jun 2024 - Aug 2024
- Developed REST APIs in Node.js
- Reduced response time by 30%

ACHIEVEMENTS
- Winner, Smart India Hackathon 2024
- Top 5% on LeetCode

CERTIFICATIONS
- AWS Cloud Practitioner
`;

describe("parseResumeText", () => {
  const resume = parseResumeText(SAMPLE_RESUME);

  it("extracts the candidate name", () => {
    expect(resume.name.toLowerCase()).toContain("anubhav");
  });

  it("extracts skills as a list", () => {
    expect(resume.skills).toContain("Python");
    expect(resume.skills).toContain("React");
    expect(resume.skills.length).toBeGreaterThanOrEqual(6);
  });

  it("extracts education", () => {
    expect(resume.education.join(" ")).toMatch(/IIT Delhi/);
  });

  it("extracts projects as separate entries", () => {
    expect(resume.projects.length).toBeGreaterThanOrEqual(2);
    expect(resume.projects.join(" ")).toMatch(/Chat Application/);
    expect(resume.projects.join(" ")).toMatch(/Resume Ranker/);
  });

  it("extracts experience", () => {
    expect(resume.experience.join(" ")).toMatch(/Acme Corp/);
  });

  it("extracts achievements and certifications", () => {
    expect(resume.achievements.join(" ")).toMatch(/Hackathon/);
    expect(resume.certifications.join(" ")).toMatch(/AWS/);
  });

  it("extracts the summary", () => {
    expect(resume.summary).toMatch(/Computer Science graduate/);
  });

  it("handles empty input without crashing", () => {
    const empty = parseResumeText("");
    expect(empty.name).toBe("");
    expect(empty.skills).toEqual([]);
  });

  it("handles unstructured garbage without crashing", () => {
    const garbage = parseResumeText("::::%%%%\n\n123 456\n@@@@");
    expect(garbage).toBeDefined();
    expect(Array.isArray(garbage.projects)).toBe(true);
  });
});
