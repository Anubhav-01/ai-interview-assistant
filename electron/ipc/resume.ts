// ============================================================
// Resume IPC: file picker + text extraction (PDF/DOCX/TXT)
// + structured parsing. All local - the file never leaves
// this machine.
// ============================================================

import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { parseResumeText } from "../../core/resume-parser";
import type { ResumeData } from "../../core/shared/types";

export interface ResumeParseResult {
  ok: boolean;
  data?: ResumeData;
  rawText?: string;
  fileName?: string;
  error?: string;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 15 MB).");
  }

  if (ext === ".txt" || ext === ".md") {
    return buffer.toString("utf8");
  }

  if (ext === ".pdf") {
    try {
      // Import the implementation directly to avoid pdf-parse's debug harness.
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(buffer);
      const text = (result?.text ?? "").trim();
      if (!text) {
        throw new Error(
          "No text could be extracted. The PDF may be scanned/image-based - try exporting it as a text-based PDF or TXT."
        );
      }
      return text;
    } catch (err: any) {
      throw new Error(
        err?.message?.includes("extract")
          ? err.message
          : `Could not read this PDF (it may be corrupted or password-protected). ${err?.message ?? ""}`
      );
    }
  }

  if (ext === ".docx") {
    try {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = (result?.value ?? "").trim();
      if (!text) throw new Error("No text found in the DOCX file.");
      return text;
    } catch (err: any) {
      throw new Error(
        `Could not read this DOCX file (it may be corrupted or an old .doc format). ${err?.message ?? ""}`
      );
    }
  }

  throw new Error(`Unsupported file type "${ext}". Use PDF, DOCX or TXT.`);
}

export function registerResumeHandlers() {
  ipcMain.handle("resume:openAndParse", async (evt): Promise<ResumeParseResult> => {
    try {
      const win = BrowserWindow.fromWebContents(evt.sender) ?? undefined;
      const result = await dialog.showOpenDialog(win!, {
        title: "Select your resume",
        properties: ["openFile"],
        filters: [
          { name: "Resume files", extensions: ["pdf", "docx", "txt", "md"] },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (result.canceled || !result.filePaths.length) {
        return { ok: false, error: "cancelled" };
      }
      const filePath = result.filePaths[0];
      const rawText = await extractText(filePath);
      const data = parseResumeText(rawText);
      return { ok: true, data, rawText, fileName: path.basename(filePath) };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Failed to parse the resume." };
    }
  });

  // Parse resume from pasted plain text (fallback path)
  ipcMain.handle("resume:parseText", async (_evt, text: unknown): Promise<ResumeParseResult> => {
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, error: "Empty resume text." };
    }
    try {
      const data = parseResumeText(text.slice(0, 200000));
      return { ok: true, data, rawText: text.slice(0, 200000) };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Failed to parse the resume text." };
    }
  });
}
