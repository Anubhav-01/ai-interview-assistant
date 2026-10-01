// ============================================================
// Job description parser.
// Pure heuristics - converts pasted JD text into structured
// JobData (title, skills, responsibilities, technologies,
// experience requirements, keywords).
// ============================================================

import { JobData, emptyJob } from "../shared/types";

const KNOWN_TECH = [
  "javascript", "typescript", "python", "java", "c++", "c#", "c", "go", "rust", "kotlin",
  "swift", "php", "ruby", "scala", "r", "matlab", "sql", "mysql", "postgresql", "postgres",
  "mongodb", "redis", "sqlite", "oracle", "react", "angular", "vue", "next.js", "nextjs",
  "node", "node.js", "nodejs", "express", "django", "flask", "fastapi", "spring", "spring boot",
  ".net", "dotnet", "html", "css", "sass", "tailwind", "bootstrap", "aws", "azure", "gcp",
  "docker", "kubernetes", "terraform", "jenkins", "git", "github", "gitlab", "ci/cd",
  "linux", "bash", "powershell", "rest", "graphql", "grpc", "kafka", "rabbitmq",
  "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "pandas", "numpy",
  "scikit-learn", "spark", "hadoop", "airflow", "tableau", "power bi", "excel",
  "figma", "jira", "agile", "scrum", "microservices", "electron", "react native", "flutter",
  "firebase", "supabase", "elasticsearch", "selenium", "cypress", "jest", "junit", "pytest",
];

const BULLET = /^[\s]*[•▪●○◦‣·\-–—*»>]+\s*/;

export function parseJobDescription(rawText: string): JobData {
  const job = emptyJob();
  const text = (rawText || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return job;

  const lines = text.split("\n").map((l) => l.trim());
  const lower = text.toLowerCase();

  job.title = guessTitle(lines);
  job.experience = guessExperience(text);
  job.technologies = KNOWN_TECH.filter((t) => containsTech(lower, t)).map(pretty);

  // Section-aware skill extraction
  const { required, preferred, responsibilities } = extractSections(lines);
  job.requiredSkills = required.length ? required : job.technologies.slice(0, 12);
  job.preferredSkills = preferred;
  job.responsibilities = responsibilities;

  job.keywords = buildKeywords(text, job);
  return job;
}

export function jobSummaryLine(j: JobData): string {
  const bits: string[] = [];
  if (j.title) bits.push(j.title);
  if (j.experience) bits.push(j.experience);
  if (j.requiredSkills.length) bits.push(`${j.requiredSkills.length} required skills`);
  if (j.responsibilities.length) bits.push(`${j.responsibilities.length} responsibilities`);
  return bits.join(" · ") || "No structured data detected";
}

// ---------- helpers ----------

function guessTitle(lines: string[]): string {
  // Explicit label first
  for (const line of lines.slice(0, 25)) {
    const m = /^(job title|role|position|designation)\s*[:\-]\s*(.+)$/i.exec(line);
    if (m) return m[2].trim().slice(0, 80);
  }
  // Otherwise: first short line that looks like a role name
  for (const line of lines.slice(0, 6)) {
    if (!line) continue;
    if (line.length > 70) continue;
    if (/about|company|we are|join|description/i.test(line)) continue;
    if (/(engineer|developer|analyst|scientist|designer|manager|intern|architect|consultant|administrator|lead|sde|qa|devops|full[- ]?stack|front[- ]?end|back[- ]?end)/i.test(line)) {
      return line.replace(/[:\-–—]+$/, "").trim().slice(0, 80);
    }
  }
  return lines.find((l) => l.length > 0)?.slice(0, 80) ?? "";
}

function guessExperience(text: string): string {
  const patterns = [
    /(\d+\s*(?:\.\d+)?\s*(?:-|to|–)\s*\d+\+?\s*years?[^.\n]*)/i,
    /(\d+\+?\s*years?[^.\n]{0,50}experience[^.\n]*)/i,
    /(experience[^.\n]{0,20}\d+\+?\s*years?[^.\n]*)/i,
    /\b(fresher|entry[- ]level|0-1 years?)\b[^.\n]*/i,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) return m[0].trim().slice(0, 120);
  }
  return "";
}

function extractSections(lines: string[]): {
  required: string[];
  preferred: string[];
  responsibilities: string[];
} {
  type Bucket = "required" | "preferred" | "responsibilities" | null;
  let current: Bucket = null;
  const out = { required: [] as string[], preferred: [] as string[], responsibilities: [] as string[] };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const headingText = line.replace(/[:\-–—]+\s*$/, "").toLowerCase();
    if (headingText.length <= 60) {
      if (/^(requirements?|required (skills?|qualifications?)|must[- ]have|qualifications?|what (we('re| are) looking for|you('ll| will) need)|skills? required|key skills?|technical skills?)/.test(headingText)) {
        current = "required";
        continue;
      }
      if (/^(preferred( skills| qualifications)?|nice[- ]to[- ]have|good[- ]to[- ]have|bonus|plus(es)?|desirable)/.test(headingText)) {
        current = "preferred";
        continue;
      }
      if (/^(responsibilit|duties|what you('ll| will) do|the role|your role|day[- ]to[- ]day|key deliverables)/.test(headingText)) {
        current = "responsibilities";
        continue;
      }
      if (/^(about|benefits|perks|compensation|salary|why join|our (team|company|culture)|location|how to apply)/.test(headingText)) {
        current = null;
        continue;
      }
    }

    if (current && (BULLET.test(raw) || line.length < 200)) {
      const item = line.replace(BULLET, "").trim();
      if (item.length >= 3 && item.length <= 220) {
        out[current].push(item);
      }
    }
  }

  return {
    required: out.required.slice(0, 15),
    preferred: out.preferred.slice(0, 10),
    responsibilities: out.responsibilities.slice(0, 10),
  };
}

function buildKeywords(text: string, job: JobData): string[] {
  const kws = new Set<string>();
  job.technologies.forEach((t) => kws.add(t.toLowerCase()));
  const roleWords = job.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  roleWords.forEach((w) => kws.add(w));
  for (const phrase of ["problem solving", "communication", "teamwork", "leadership", "data structures", "algorithms", "testing", "debugging", "optimization", "security"]) {
    if (text.toLowerCase().includes(phrase)) kws.add(phrase);
  }
  return [...kws].slice(0, 25);
}

function containsTech(lowerText: string, tech: string): boolean {
  const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-ish boundary: avoid matching "c" inside words, "r" etc.
  const re = new RegExp(`(^|[^a-z0-9+#.])${escaped}($|[^a-z0-9+#])`, "i");
  return re.test(lowerText);
}

function pretty(tech: string): string {
  const special: Record<string, string> = {
    "node.js": "Node.js", nodejs: "Node.js", node: "Node.js",
    "next.js": "Next.js", nextjs: "Next.js",
    javascript: "JavaScript", typescript: "TypeScript",
    mysql: "MySQL", postgresql: "PostgreSQL", postgres: "PostgreSQL",
    mongodb: "MongoDB", sqlite: "SQLite", "ci/cd": "CI/CD",
    aws: "AWS", gcp: "GCP", nlp: "NLP", html: "HTML", css: "CSS", sql: "SQL",
    "power bi": "Power BI", "c++": "C++", "c#": "C#", ".net": ".NET",
    php: "PHP", graphql: "GraphQL", grpc: "gRPC", rest: "REST",
  };
  return special[tech] ?? tech.charAt(0).toUpperCase() + tech.slice(1);
}
