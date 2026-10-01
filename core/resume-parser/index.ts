// ============================================================
// Resume parser (pure part).
// Takes raw extracted text (from PDF/DOCX/TXT) and converts it
// into structured ResumeData using section heuristics.
// Text extraction from binary files happens in the Electron
// main process (electron/ipc/resume.ts) using pdf-parse/mammoth.
// ============================================================

import { ResumeData, emptyResume } from "../shared/types";

type SectionKey = keyof Omit<ResumeData, "name" | "summary"> | "summary";

const SECTION_HEADINGS: Array<{ key: SectionKey; patterns: RegExp[] }> = [
  {
    key: "education",
    patterns: [/^(education|academics?|academic (background|details|qualifications?)|qualifications?)\b/i],
  },
  {
    key: "skills",
    patterns: [/^(technical )?skills?\b/i, /^(core competenc|technologies|tech stack|tools)/i],
  },
  {
    key: "projects",
    patterns: [/^(personal |academic |key |selected )?projects?\b/i],
  },
  {
    key: "experience",
    patterns: [
      /^(work |professional |employment |relevant )?experience\b/i,
      /^(internships?|employment( history)?|work history)\b/i,
    ],
  },
  {
    key: "achievements",
    patterns: [/^(achievements?|awards?|honou?rs?|accomplishments?)\b/i],
  },
  {
    key: "certifications",
    patterns: [/^(certifications?|certificates?|courses?( and certifications?)?|licenses?)\b/i],
  },
  {
    key: "summary",
    patterns: [/^(summary|professional summary|profile|objective|career objective|about( me)?)\b/i],
  },
];

const BULLET = /^[\s]*[•▪●○◦‣·\-–—*»>]+\s*/;

export function parseResumeText(rawText: string): ResumeData {
  const resume = emptyResume();
  const text = normalize(rawText);
  if (!text.trim()) return resume;

  const lines = text.split("\n").map((l) => l.replace(/\s+$/g, ""));

  resume.name = guessName(lines);

  // Walk lines, bucketing content under the current section heading.
  let current: SectionKey | null = null;
  const buckets: Record<SectionKey, string[]> = {
    education: [],
    skills: [],
    projects: [],
    experience: [],
    achievements: [],
    certifications: [],
    summary: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) buckets[current].push(""); // preserve entry separation
      continue;
    }
    const heading = detectHeading(trimmed);
    if (heading) {
      current = heading;
      continue;
    }
    if (current) buckets[current].push(trimmed);
  }

  resume.summary = buckets.summary.filter(Boolean).join(" ").slice(0, 600);
  resume.skills = parseSkills(buckets.skills);
  resume.education = groupEntries(buckets.education, 6);
  resume.projects = groupEntries(buckets.projects, 8);
  resume.experience = groupEntries(buckets.experience, 8);
  resume.achievements = groupEntries(buckets.achievements, 8);
  resume.certifications = groupEntries(buckets.certifications, 8);

  return resume;
}

/** Build a short one-line summary of what was parsed (for the UI). */
export function resumeSummaryLine(r: ResumeData): string {
  const bits: string[] = [];
  if (r.name) bits.push(r.name);
  if (r.skills.length) bits.push(`${r.skills.length} skills`);
  if (r.projects.length) bits.push(`${r.projects.length} projects`);
  if (r.experience.length) bits.push(`${r.experience.length} experience entries`);
  if (r.education.length) bits.push(`${r.education.length} education entries`);
  return bits.join(" · ") || "No structured data detected";
}

// ---------- helpers ----------

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function detectHeading(line: string): SectionKey | null {
  // Headings are short lines, often uppercase, without trailing sentence text.
  const clean = line.replace(/[:\-–—_|]+\s*$/g, "").trim();
  if (clean.length > 40) return null;
  const wordCount = clean.split(/\s+/).length;
  if (wordCount > 5) return null;
  for (const { key, patterns } of SECTION_HEADINGS) {
    if (patterns.some((p) => p.test(clean))) return key;
  }
  return null;
}

function guessName(lines: string[]): string {
  for (const line of lines.slice(0, 8)) {
    const t = line.trim().replace(BULLET, "");
    if (!t) continue;
    if (/[@\d]/.test(t)) continue; // emails / phones
    if (/resume|curriculum vitae|cv\b/i.test(t)) continue;
    if (detectHeading(t)) continue;
    const words = t.split(/\s+/);
    if (words.length >= 1 && words.length <= 4 && t.length <= 40 && /^[A-Za-z .'-]+$/.test(t)) {
      return toTitleCase(t);
    }
  }
  return "";
}

function toTitleCase(s: string): string {
  if (s === s.toUpperCase()) {
    return s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return s;
}

function parseSkills(lines: string[]): string[] {
  const joined = lines.filter(Boolean).join("\n");
  const skills = joined
    .split(/[\n,;|•▪●○◦‣·]+/)
    .map((s) => s.replace(BULLET, "").replace(/^[A-Za-z &/]+:\s*/, "").trim())
    .flatMap((s) => (s.includes(",") ? s.split(",") : [s]))
    .map((s) => s.trim())
    .filter((s) => s.length >= 1 && s.length <= 40 && !/^\d+$/.test(s));
  return dedupe(skills).slice(0, 40);
}

/**
 * Group section lines into entries. A new entry starts at a blank
 * separator or a line that looks like a title (non-bullet after bullets,
 * or contains a date range).
 */
function groupEntries(lines: string[], limit: number): string[] {
  const entries: string[] = [];
  let cur: string[] = [];

  const flush = () => {
    const joined = cur
      .map((l) => l.replace(BULLET, "").trim())
      .filter(Boolean)
      .join(" — ")
      .slice(0, 500);
    if (joined) entries.push(joined);
    cur = [];
  };

  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    const isBullet = BULLET.test(line);
    const looksLikeTitle =
      !isBullet &&
      cur.length > 0 &&
      (BULLET.test(cur[cur.length - 1] ?? "") || hasDateRange(line));
    if (looksLikeTitle) flush();
    cur.push(line);
  }
  flush();

  return dedupe(entries).slice(0, limit);
}

function hasDateRange(line: string): boolean {
  return /(19|20)\d{2}\s*[-–—to]+\s*((19|20)\d{2}|present|current|now)/i.test(line) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i.test(line);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
