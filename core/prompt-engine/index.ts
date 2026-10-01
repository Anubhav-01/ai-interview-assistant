// ============================================================
// Prompt engine.
// Builds the final system/user prompts from question type,
// candidate context, job context and conversation context.
// ============================================================

import type {
  AnswerLength,
  BuiltPrompt,
  GenerateRequest,
  Language,
  QuestionType,
} from "../shared/types";

const LENGTH_GUIDE: Record<AnswerLength, string> = {
  "Very Short": "Keep the answer to 1-2 sentences (about 30-50 spoken words).",
  Short: "Keep the answer to 3-4 sentences (about 60-90 spoken words).",
  Medium: "Keep the answer to a focused paragraph (about 100-150 spoken words).",
  Detailed:
    "Give a thorough but well-organized answer (about 180-260 spoken words). Stay on-topic.",
};

const LANGUAGE_GUIDE: Record<Language, string> = {
  English: "Answer in natural, conversational English.",
  Hindi: "Answer in natural, conversational Hindi (Devanagari script).",
  Hinglish:
    "Answer in Hinglish - a natural mix of Hindi and English as commonly spoken in Indian tech interviews. Keep technical terms in English.",
};

const TYPE_GUIDE: Record<QuestionType, string> = {
  INTRODUCTION: `This is a self-introduction question.
- Open with who the candidate is (role/education), then 1-2 strongest skills or projects from the resume, then connect briefly to the target role.
- Sound like a real person talking, not a rehearsed script.
- Never use clichés like "highly motivated individual with a proven track record".`,
  HR: `This is an HR question.
- Sound human, warm and honest - avoid corporate buzzwords entirely.
- Ground claims in real resume facts where possible.
- For weakness questions, give a genuine minor weakness plus how the candidate is improving it.`,
  BEHAVIORAL: `This is a behavioral question.
- Internally structure the answer as Situation -> Task -> Action -> Result (STAR), but do NOT print those headings.
- Use a real project/experience from the resume as the situation. If nothing fits, use an honest academic/team scenario consistent with the resume.
- End with the concrete result or learning.`,
  TECHNICAL: `This is a technical question.
- Structure: brief definition -> simple explanation -> small example -> one important detail or gotcha.
- Be precise. If unsure about a fact, keep the answer conservative rather than guessing.`,
  CODING: `This is a coding question.
- Format the answer exactly as:
Approach:
<1-3 lines>

Code:
\`\`\`<language>
<correct, runnable code>
\`\`\`

Time Complexity: O(...)
Space Complexity: O(...)
- Default to the language the interviewer mentioned; otherwise pick the language most prominent in the candidate's resume skills (fall back to Python).
- The code must be correct and idiomatic.`,
  SQL: `This is a SQL question.
- Format the answer exactly as:
SQL Query:
\`\`\`sql
<query>
\`\`\`

Explanation: <2-3 concise lines>
- Use standard ANSI SQL unless a specific dialect is requested.`,
  PROJECT: `This is a question about the candidate's projects.
- Pick the single most relevant project from the resume context (matching the question and the job description).
- Cover: what it does, the candidate's role, tech stack, and one concrete outcome or challenge solved.
- Only mention projects that actually appear in the resume context.`,
  RESUME: `This question is about the candidate's background (education/experience/certifications).
- Answer strictly from the resume context. Do not add anything that is not there.
- If the resume lacks the requested information, say so honestly and pivot to the closest real strength.`,
  SYSTEM_DESIGN: `This is a system design question.
- Structure: clarify scope in one line -> core components -> data flow -> key trade-off or scaling consideration.
- Keep it spoken-friendly: describe the architecture verbally, no diagrams.`,
  FOLLOW_UP: `This is a FOLLOW-UP question referring to the previous exchange.
- Look at the "Recent Interview Context" and continue from the most recent answer - especially the project/topic just discussed.
- Do not re-introduce the candidate or repeat the previous answer; add the new information asked for.`,
  GENERAL: `This is a general interview question.
- Answer directly and naturally, grounded in the candidate's real background where relevant.`,
};

const MODIFIER_GUIDE: Record<string, string> = {
  regenerate:
    "Produce a fresh alternative answer with different wording and, where possible, a different (still truthful) angle than a typical first answer.",
  shorter:
    "Make this answer noticeably SHORTER than normal - roughly half the usual length for the requested answer length. Keep only the strongest points.",
  simpler:
    "Use SIMPLER language - short sentences, everyday words, no jargon unless strictly needed. It should be easy to say out loud without practice.",
};

export function buildPrompt(req: GenerateRequest): BuiltPrompt {
  const system = `You are an AI interview assistant.

Your task is to help the candidate formulate a concise, natural and truthful response to an interview question, which they will speak out loud.

Hard rules:
1. Answer the question directly - no preamble like "Great question".
2. Keep the answer natural and conversational, easy to speak.
3. Use ONLY verified candidate information from the Candidate Context.
4. NEVER invent companies, job experience, projects, certifications, achievements, technologies or responsibilities.
5. If the candidate genuinely lacks something, be honest about it and pivot to a real, related strength.
6. Do not exaggerate. No corporate clichés or buzzword strings.
7. Use technical depth when appropriate for the question.
8. For follow-up questions, use the recent interview context.
9. ${LANGUAGE_GUIDE[req.language]}
10. ${LENGTH_GUIDE[req.answerLength]}

Return ONLY the final answer text, ready to be spoken. No meta commentary.`;

  const parts: string[] = [];

  parts.push(`Candidate Context:\n${req.candidateContext || "(none)"}`);
  parts.push(`Job Description Context:\n${req.jobContext || "(none)"}`);
  parts.push(`Recent Interview Context:\n${req.conversationContext || "(none)"}`);
  parts.push(`Interview Type: ${req.interviewType}`);
  if (req.targetRole) parts.push(`Target Role: ${req.targetRole}`);
  parts.push(`Current Question:\n${req.question}`);
  parts.push(`Question Type: ${req.questionType}`);
  parts.push(`Guidance for this question type:\n${TYPE_GUIDE[req.questionType]}`);

  if (req.modifier && MODIFIER_GUIDE[req.modifier]) {
    parts.push(`Additional instruction:\n${MODIFIER_GUIDE[req.modifier]}`);
  }

  return { system, user: parts.join("\n\n") };
}
