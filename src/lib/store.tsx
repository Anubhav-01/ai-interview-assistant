// ============================================================
// Global app state (simple React context - no external state lib).
// ============================================================

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AppSettings,
  InterviewConfig,
  JobData,
  ResumeData,
  SessionData,
} from "@core/shared/types";
import type { ProviderInfo } from "@/types";

export type Screen = "setup" | "interview" | "history" | "settings";

interface AppStore {
  settings: AppSettings | null;
  setSettings: (s: AppSettings) => void;
  saveSettings: (s: AppSettings) => Promise<string | null>;

  providerInfo: ProviderInfo | null;
  refreshProviderInfo: () => Promise<void>;

  resume: ResumeData | null;
  setResume: (r: ResumeData | null) => void;
  resumeFileName: string;
  setResumeFileName: (n: string) => void;

  job: JobData | null;
  setJob: (j: JobData | null) => void;
  jobText: string;
  setJobText: (t: string) => void;

  config: InterviewConfig;
  setConfig: (c: InterviewConfig) => void;

  session: SessionData | null;
  setSession: (s: SessionData | null) => void;

  screen: Screen;
  setScreen: (s: Screen) => void;

  compact: boolean;
  setCompact: (v: boolean) => void;
}

const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [job, setJob] = useState<JobData | null>(null);
  const [jobText, setJobText] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [screen, setScreen] = useState<Screen>("setup");
  const [compact, setCompact] = useState(false);
  const [config, setConfig] = useState<InterviewConfig>({
    candidateName: "",
    targetRole: "",
    interviewType: "Mixed",
    language: "English",
    answerLength: "Short",
  });

  const refreshProviderInfo = async () => {
    try {
      setProviderInfo(await window.api.ai.providerInfo());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const s = await window.api.settings.get();
        setSettings(s);
        applyAppearance(s);
      } catch {
        /* main not ready - unlikely */
      }
      await refreshProviderInfo();
    })();
  }, []);

  const saveSettings = async (s: AppSettings): Promise<string | null> => {
    const result = await window.api.settings.set(s);
    if (result.ok && result.settings) {
      setSettings(result.settings);
      applyAppearance(result.settings);
      await refreshProviderInfo();
      return null;
    }
    return result.error ?? "Failed to save settings.";
  };

  const value = useMemo<AppStore>(
    () => ({
      settings, setSettings, saveSettings,
      providerInfo, refreshProviderInfo,
      resume, setResume, resumeFileName, setResumeFileName,
      job, setJob, jobText, setJobText,
      config, setConfig,
      session, setSession,
      screen, setScreen,
      compact, setCompact,
    }),
    [settings, providerInfo, resume, resumeFileName, job, jobText, config, session, screen, compact]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): AppStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside AppStoreProvider");
  return ctx;
}

function applyAppearance(s: AppSettings) {
  const root = document.documentElement;
  root.classList.toggle("light", s.appearance.theme === "light");
  root.classList.toggle("dark", s.appearance.theme === "dark");
  root.style.fontSize = `${s.appearance.fontSize}px`;
  window.api.win.setOpacity(s.appearance.opacity).catch(() => {});
}

export function newSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
