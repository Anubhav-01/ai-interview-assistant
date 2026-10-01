// ============================================================
// Context engine.
// Maintains recent interview context and builds compact,
// grounded context blocks for the AI - without resending the
// full resume or full interview history on every request.
// ============================================================

import type { JobData, QAPair, ResumeData } from "../shared/types";

const MAX_PAIRS = 4; // most recent Q&A pairs sent to the model
const MAX_CONVO_CHARS = 2600;
const MAX_ANSWER_SNIPPET = 420;
const MAX_CANDIDATE_CHARS = 2200;
const MAX_JOB_CHARS = 1200;

// ---------- Conversation context ----------

/**
 * Build a compact conversation context from recent Q&A pairs.
 * Older answers are trimmed harder than recent ones so that
 * follow-up questions keep working while staying cheap.
 */
export function buildConversationContext(history: QAPair[]): string {
  if (!history.length) return "(none - this is the first question)";

  const recent = history.slice(-MAX_PAIRS);
  const blocks: string[] = [];

  recent.forEach((pair, i) => {
    const isLast = i === recent.length - 1;
    const answer = isLast
      ? snippet(pair.answer, MAX_ANSWER_SNIPPET * 2)
      : snippet(pair.answer, MAX_ANSWER_SNIPPET);
    blocks.push(`Interviewer: ${snippet(pair.question, 240)}\nCandidate: ${answer}`);
  });

  let context = blocks.join("\n\n");
  // Hard cap: drop oldest blocks until under budget.
  while (context.length > MAX_CONVO_CHARS && blocks.length > 1) {
    blocks.shift();
    context = blocks.join("\n\n");
  }
  return context;
}

// ---------- Candidate (resume) grounding ----------

/**
 * Build a compact candidate context, prioritizing resume sections
 * relevant to the current question (resume grounding).
 * Only verified resume data is included - the prompt engine
 * additionally instructs the model to never invent facts.
 */
export function buildCandidateContext(
  resume: ResumeData,
  question = "",
  jobKeywords: string[] = []
): string {
  const parts: string[] = [];
  if (resume.name) parts.push(`Name: ${resume.name}`);
  if (resume.summary) parts.push(`Summary: ${snippet(resume.summary, 300)}`);

  const scoreWords = extractKeywords(question).concat(
    jobKeywords.map((k) => k.toLowerCase())
  );

  pushSection(parts, "Skills", rankItems(resume.skills, scoreWords, 18), 400);
  pushSection(parts, "Experience", rankItems(resume.experience, scoreWords, 4), 700);
  pushSection(parts, "Projects", rankItems(resume.projects, scoreWords, 4), 700);
  pushSection(parts, "Education", resume.education.slice(0, 3), 300);
  pushSection(parts, "Achievements", rankItems(resume.achievements, scoreWords, 4), 300);
  pushSection(parts, "Certifications", resume.certifications.slice(0, 5), 250);

  let out = parts.join("\n");
  if (out.length > MAX_CANDIDATE_CHARS) out = out.slice(0, MAX_CANDIDATE_CHARS) + "…";
  return out || "(no resume provided)";
}

// ---------- Job context ----------

export function buildJobContext(job: JobData): string {
  const parts: string[] = [];
  if (job.title) parts.push(`Role: ${job.title}`);
  if (job.experience) parts.push(`Experience required: ${job.experience}`);
  if (job.requiredSkills.length)
    parts.push(`Required skills: ${job.requiredSkills.slice(0, 15).join(", ")}`);
  if (job.preferredSkills.length)
    parts.push(`Preferred skills: ${job.preferredSkills.slice(0, 10).join(", ")}`);
  if (job.technologies.length)
    parts.push(`Technologies: ${job.technologies.slice(0, 15).join(", ")}`);
  if (job.responsibilities.length)
    parts.push(
      `Key responsibilities:\n- ${job.responsibilities.slice(0, 6).map((r) => snippet(r, 140)).join("\n- ")}`
    );

  let out = parts.join("\n");
  if (out.length > MAX_JOB_CHARS) out = out.slice(0, MAX_JOB_CHARS) + "…";
  return out || "(no job description provided)";
}

// ---------- helpers ----------

function pushSection(
  parts: string[],
  label: string,
  items: string[],
  maxChars: number
) {
  if (!items.length) return;
  let joined =
    label === "Skills"
      ? items.join(", ")
      : items.map((i) => `- ${i}`).join("\n");
  if (joined.length > maxChars) joined = joined.slice(0, maxChars) + "…";
  parts.push(label === "Skills" ? `${label}: ${joined}` : `${label}:\n${joined}`);
}

/** Rank items by keyword overlap with the question/JD; keep original order for ties. */
function rankItems(items: string[], keywords: string[], limit: number): string[] {
  if (items.length <= limit || keywords.length === 0) return items.slice(0, limit);
  const scored = items.map((item, idx) => {
    const low = item.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (kw.length >= 3 && low.includes(kw)) score++;
    }
    return { item, idx, score };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.slice(0, limit).map((s) => s.item);
}

const STOPWORDS = new Set(
  "the a an is are was were be been being do does did have has had what why how when where which who whom your you me my i we our us tell about with for and or of in on at to from by as it its this that these those can could would should will shall may might most more very".split(
    " "
  )
);

function extractKeywords(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function snippet(text: string, max: number): string {
  const t = (text || "").trim();
  return t.length <= max ? t : t.slice(0, max) + "…";
}
