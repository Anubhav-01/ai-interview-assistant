// ============================================================
// Shared types used across main process, renderer and core.
// ============================================================

export type QuestionType =
  | "INTRODUCTION"
  | "HR"
  | "BEHAVIORAL"
  | "TECHNICAL"
  | "CODING"
  | "SQL"
  | "PROJECT"
  | "RESUME"
  | "SYSTEM_DESIGN"
  | "FOLLOW_UP"
  | "GENERAL";

export type InterviewType =
  | "HR"
  | "Behavioral"
  | "Technical"
  | "Coding"
  | "SQL"
  | "System Design"
  | "General"
  | "Mixed";

export type AnswerLength = "Very Short" | "Short" | "Medium" | "Detailed";

export type Language = "English" | "Hindi" | "Hinglish";

export type AIProviderId = "openai" | "gemini" | "mock";
export type SpeechProviderId = "whisper" | "browser" | "mock";

export type AnswerModifier = "regenerate" | "shorter" | "simpler";

// ---------- Resume ----------

export interface ResumeData {
  name: string;
  summary: string;
  education: string[];
  skills: string[];
  projects: string[];
  experience: string[];
  achievements: string[];
  certifications: string[];
}

export function emptyResume(): ResumeData {
  return {
    name: "",
    summary: "",
    education: [],
    skills: [],
    projects: [],
    experience: [],
    achievements: [],
    certifications: [],
  };
}

// ---------- Job description ----------

export interface JobData {
  title: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  technologies: string[];
  experience: string;
  keywords: string[];
}

export function emptyJob(): JobData {
  return {
    title: "",
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    technologies: [],
    experience: "",
    keywords: [],
  };
}

// ---------- Interview session ----------

export interface QAPair {
  question: string;
  answer: string;
  questionType: QuestionType;
  timestamp: number;
}

export interface SessionData {
  id: string;
  createdAt: string;
  jobTitle: string;
  targetRole: string;
  interviewType: InterviewType;
  candidateName: string;
  qa: QAPair[];
}

// ---------- AI generation ----------

export interface GenerateRequest {
  question: string;
  questionType: QuestionType;
  candidateContext: string;
  jobContext: string;
  conversationContext: string;
  interviewType: InterviewType;
  targetRole: string;
  language: Language;
  answerLength: AnswerLength;
  modifier?: AnswerModifier;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

export interface GenerateResult {
  ok: boolean;
  answer?: string;
  error?: string;
}

// ---------- Settings ----------

export interface ShortcutSettings {
  toggleListening: string;
  toggleWindow: string;
  regenerate: string;
  copy: string;
}

export interface AppSettings {
  ai: {
    provider: AIProviderId;
    openaiApiKey: string;
    openaiModel: string;
    geminiApiKey: string;
    geminiModel: string;
    temperature: number;
  };
  speech: {
    provider: SpeechProviderId;
    language: Language;
  };
  appearance: {
    theme: "dark" | "light";
    fontSize: number; // base px
    opacity: number; // 0.4 - 1
  };
  shortcuts: ShortcutSettings;
}

export function defaultSettings(): AppSettings {
  return {
    ai: {
      provider: "mock",
      openaiApiKey: "",
      openaiModel: "gpt-4o-mini",
      geminiApiKey: "",
      geminiModel: "gemini-1.5-flash",
      temperature: 0.6,
    },
    speech: {
      provider: "mock",
      language: "English",
    },
    appearance: {
      theme: "dark",
      fontSize: 15,
      opacity: 1,
    },
    shortcuts: {
      toggleListening: "CommandOrControl+Shift+Space",
      toggleWindow: "CommandOrControl+Shift+H",
      regenerate: "CommandOrControl+Shift+R",
      copy: "CommandOrControl+Shift+C",
    },
  };
}

// ---------- Interview setup ----------

export interface InterviewConfig {
  candidateName: string;
  targetRole: string;
  interviewType: InterviewType;
  language: Language;
  answerLength: AnswerLength;
}

export const INTERVIEW_TYPES: InterviewType[] = [
  "HR",
  "Behavioral",
  "Technical",
  "Coding",
  "SQL",
  "System Design",
  "General",
  "Mixed",
];

export const LANGUAGES: Language[] = ["English", "Hindi", "Hinglish"];

export const ANSWER_LENGTHS: AnswerLength[] = [
  "Very Short",
  "Short",
  "Medium",
  "Detailed",
];

// ---------- Speech pipeline status ----------

export type AssistantStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "understanding"
  | "generating"
  | "ready"
  | "error";
