// ============================================================
// Session history IPC: local JSON files under data/sessions.
// No cloud, no database. View / delete / export supported.
// ============================================================

import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "./settings";
import type { SessionData } from "../../core/shared/types";

function sessionsDir(): string {
  return path.join(getDataDir(), "sessions");
}

const ID_RE = /^session-[a-z0-9-]+$/i;

function sessionFile(id: string): string {
  if (!ID_RE.test(id)) throw new Error("Invalid session id.");
  return path.join(sessionsDir(), `${id}.json`);
}

function sanitizeSession(input: unknown): SessionData | null {
  const s = input as any;
  if (!s || typeof s !== "object") return null;
  if (typeof s.id !== "string" || !ID_RE.test(s.id)) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const qa = Array.isArray(s.qa)
    ? s.qa.slice(0, 500).map((p: any) => ({
        question: str(p?.question, 4000),
        answer: str(p?.answer, 20000),
        questionType: str(p?.questionType, 30) || "GENERAL",
        timestamp: typeof p?.timestamp === "number" ? p.timestamp : Date.now(),
      }))
    : [];
  return {
    id: s.id,
    createdAt: str(s.createdAt, 40) || new Date().toISOString(),
    jobTitle: str(s.jobTitle, 120),
    targetRole: str(s.targetRole, 120),
    interviewType: str(s.interviewType, 30) as SessionData["interviewType"],
    candidateName: str(s.candidateName, 80),
    qa,
  };
}

export function registerSessionHandlers() {
  ipcMain.handle("sessions:list", async (): Promise<SessionData[]> => {
    try {
      const dir = sessionsDir();
      await fs.mkdir(dir, { recursive: true });
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
      const sessions: SessionData[] = [];
      for (const file of files) {
        try {
          const raw = await fs.readFile(path.join(dir, file), "utf8");
          const parsed = sanitizeSession(JSON.parse(raw));
          if (parsed) sessions.push(parsed);
        } catch {
          /* skip corrupted file */
        }
      }
      sessions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return sessions;
    } catch {
      return [];
    }
  });

  ipcMain.handle("sessions:save", async (_evt, raw: unknown) => {
    const session = sanitizeSession(raw);
    if (!session) return { ok: false, error: "Invalid session data." };
    try {
      await fs.mkdir(sessionsDir(), { recursive: true });
      await fs.writeFile(sessionFile(session.id), JSON.stringify(session, null, 2), "utf8");
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `Could not save session: ${err?.message}` };
    }
  });

  ipcMain.handle("sessions:delete", async (_evt, id: unknown) => {
    if (typeof id !== "string" || !ID_RE.test(id)) {
      return { ok: false, error: "Invalid session id." };
    }
    try {
      await fs.unlink(sessionFile(id));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `Could not delete session: ${err?.message}` };
    }
  });

  ipcMain.handle("sessions:export", async (evt, id: unknown) => {
    if (typeof id !== "string" || !ID_RE.test(id)) {
      return { ok: false, error: "Invalid session id." };
    }
    try {
      const raw = await fs.readFile(sessionFile(id), "utf8");
      const session = sanitizeSession(JSON.parse(raw));
      if (!session) return { ok: false, error: "Session file is corrupted." };

      const win = BrowserWindow.fromWebContents(evt.sender) ?? undefined;
      const result = await dialog.showSaveDialog(win!, {
        title: "Export session",
        defaultPath: `interview-${session.createdAt.slice(0, 10)}.md`,
        filters: [
          { name: "Markdown", extensions: ["md"] },
          { name: "JSON", extensions: ["json"] },
        ],
      });
      if (result.canceled || !result.filePath) return { ok: false, error: "cancelled" };

      const isJson = result.filePath.toLowerCase().endsWith(".json");
      const content = isJson ? JSON.stringify(session, null, 2) : toMarkdown(session);
      await fs.writeFile(result.filePath, content, "utf8");
      return { ok: true, path: result.filePath };
    } catch (err: any) {
      return { ok: false, error: `Export failed: ${err?.message}` };
    }
  });
}

function toMarkdown(s: SessionData): string {
  const lines = [
    `# Interview Session - ${s.jobTitle || s.targetRole || "Untitled"}`,
    ``,
    `- Date: ${s.createdAt}`,
    `- Candidate: ${s.candidateName || "-"}`,
    `- Interview type: ${s.interviewType || "-"}`,
    `- Questions: ${s.qa.length}`,
    ``,
  ];
  s.qa.forEach((pair, i) => {
    lines.push(`## Q${i + 1} (${pair.questionType})`, ``, `**${pair.question}**`, ``, pair.answer, ``);
  });
  return lines.join("\n");
}
