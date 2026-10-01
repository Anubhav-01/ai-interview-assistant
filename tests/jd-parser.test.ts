import { describe, it, expect } from "vitest";
import { parseJobDescription } from "@core/jd-parser";

const SAMPLE_JD = `
Backend Engineer

About the role:
We are looking for a Backend Engineer to join our platform team.

Responsibilities:
- Design and build REST APIs
- Own services end to end
- Collaborate with frontend engineers

Requirements:
- 2+ years of experience with Node.js and TypeScript
- Strong SQL and PostgreSQL knowledge
- Experience with Docker and AWS

Nice to have:
- Kubernetes experience
- GraphQL
`;

describe("parseJobDescription", () => {
  const job = parseJobDescription(SAMPLE_JD);

  it("extracts the job title", () => {
    expect(job.title).toBe("Backend Engineer");
  });

  it("extracts required skills", () => {
    const joined = job.requiredSkills.join(" ");
    expect(joined).toMatch(/Node\.js/i);
    expect(joined).toMatch(/SQL/i);
  });

  it("extracts preferred skills", () => {
    expect(job.preferredSkills.join(" ")).toMatch(/Kubernetes/i);
  });

  it("extracts responsibilities", () => {
    expect(job.responsibilities.join(" ")).toMatch(/REST APIs/);
  });

  it("detects technologies", () => {
    expect(job.technologies).toContain("TypeScript");
    expect(job.technologies).toContain("Docker");
    expect(job.technologies).toContain("AWS");
    expect(job.technologies).toContain("PostgreSQL");
  });

  it("extracts experience requirements", () => {
    expect(job.experience).toMatch(/2\+?\s*years/i);
  });

  it("builds keywords", () => {
    expect(job.keywords.length).toBeGreaterThan(3);
  });

  it("handles empty input", () => {
    const empty = parseJobDescription("");
    expect(empty.title).toBe("");
    expect(empty.requiredSkills).toEqual([]);
  });
});
