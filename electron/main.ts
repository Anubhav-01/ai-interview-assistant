// ============================================================
// Electron main process.
//
// Architecture: single main process + single renderer window,
// connected through a secure preload bridge. No background
// services, no telemetry, no hidden processes. Everything
// terminates when the window closes.
// ============================================================

import { app, BrowserWindow, globalShortcut, session, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { registerAllIpc } from "./ipc";
import { loadSettings } from "./ipc/settings";
import { cancelActiveAIRequest } from "./ipc/ai";
import type { AppSettings, ShortcutSettings } from "../core/shared/types";

// ---------- .env loading (dev: project root; packaged: next to exe) ----------
function loadEnv() {
  try {
    const dotenv = require("dotenv");
    const candidates = [
      path.join(app.getAppPath(), ".env"),
      path.join(path.dirname(app.getPath("exe")), ".env"),
      path.join(process.cwd(), ".env"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        break;
      }
    }
  } catch {
    /* dotenv optional */
  }
}

let mainWindow: BrowserWindow | null = null;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// ---------- stdio hardening (must run before any logging) ----------
// In a packaged Windows GUI app stdout/stderr can be a closed pipe.
// Crucially, stream write failures (EPIPE) are emitted ASYNCHRONOUSLY as an
// 'error' event on process.stdout/stderr - a try/catch around console.log
// cannot catch them, and with no 'error' listener they become an uncaught
// exception in the main process (the "EPIPE: broken pipe, write" dialog).
// Attaching listeners makes log-stream failures harmlessly ignored.
for (const stream of [process.stdout, process.stderr]) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  stream?.on?.("error", () => {
    /* broken log pipe - never crash the app over logging */
  });
}

// Crash-proof local logging: catches the synchronous failure modes
// (e.g. stream already destroyed); async EPIPE is handled above.
function safeLog(...args: unknown[]) {
  try { console.log(...args); } catch { /* stdout unavailable */ }
}
function safeError(...args: unknown[]) {
  try { console.error(...args); } catch { /* stderr unavailable */ }
}

// Never crash / freeze on unexpected errors (e.g. EPIPE on closed
// stdout in packaged builds). Errors are logged locally only.
process.on("uncaughtException", (err) => {
  safeError("[main] uncaught exception:", err?.message ?? err);
});
process.on("unhandledRejection", (reason) => {
  safeError("[main] unhandled rejection:", reason);
});

// Single instance - avoid duplicate processes.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    frame: false, // custom titlebar (drag region) for floating-window UX
    backgroundColor: "#0b0f19",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Local debugging aid: forward renderer errors to the terminal.
  // (Purely local logging - nothing is transmitted anywhere.)
  mainWindow.webContents.on("console-message", (_evt, level, message, line, sourceId) => {
    if (level >= 3) safeError(`[renderer:error] ${message} (${sourceId}:${line})`);
  });

  // Automated smoke test hook (used by `npm test` tooling only).
  // Results are also written to a temp file because a packaged GUI
  // app has no reliable stdout.
  if (process.env.AIA_SMOKE_TEST === "1") {
    const smokeOut = path.join(app.getPath("temp"), "aia-smoke-results.json");
    mainWindow.webContents.once("did-finish-load", async () => {
      safeLog("[smoke] renderer loaded");
      try {
        const result = await mainWindow!.webContents.executeJavaScript(`(async () => {
          const out = {};
          out.hasApi = typeof window.api === "object";
          const settings = await window.api.settings.get();
          out.settingsOk = settings && settings.ai && typeof settings.ai.provider === "string";
          const gen = await window.api.ai.generate({
            question: "Tell me about yourself.",
            questionType: "INTRODUCTION",
            candidateContext: "Name: Smoke Tester",
            jobContext: "Role: Tester",
            conversationContext: "",
            interviewType: "Mixed",
            targetRole: "Tester",
            language: "English",
            answerLength: "Short",
          });
          out.generateOk = gen.ok === true && typeof gen.answer === "string" && gen.answer.length > 10;
          const id = "session-smoke-test";
          const save = await window.api.sessions.save({
            id, createdAt: new Date().toISOString(), jobTitle: "Smoke", targetRole: "T",
            interviewType: "Mixed", candidateName: "S", qa: [{question:"q",answer:"a",questionType:"GENERAL",timestamp:Date.now()}],
          });
          out.saveOk = save.ok === true;
          const list = await window.api.sessions.list();
          out.listOk = Array.isArray(list) && list.some(s => s.id === id);
          const del = await window.api.sessions.remove(id);
          out.deleteOk = del.ok === true;
          return JSON.stringify(out);
        })()`);
        safeLog(`[smoke] results: ${result}`);
        try { fs.writeFileSync(smokeOut, String(result), "utf8"); } catch { /* ignore */ }
      } catch (err) {
        safeError(`[smoke] FAILED: ${err}`);
        try { fs.writeFileSync(smokeOut, JSON.stringify({ failed: String(err) }), "utf8"); } catch { /* ignore */ }
      }
      setTimeout(() => {
        safeLog("[smoke] exiting cleanly");
        app.quit();
      }, 500);
    });
  }

  // Open external links in the default browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------- Content Security Policy (production) ----------
// The renderer never talks to external APIs directly (that happens
// in the main process), so its CSP can stay strict.
function applyCsp() {
  if (isDev) return; // vite dev server needs inline HMR scripts
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob: mediastream:; connect-src 'self' blob:; font-src 'self' data:",
        ],
      },
    });
  });
}

// ---------- Microphone permission ----------
function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    // Only the microphone is ever needed.
    callback(permission === "media");
  });
}

// ---------- Global shortcuts ----------
function registerShortcuts(shortcuts: ShortcutSettings) {
  globalShortcut.unregisterAll();
  const send = (action: string) => mainWindow?.webContents.send("shortcut", action);

  const entries: Array<[string, () => void]> = [
    [shortcuts.toggleListening, () => send("toggleListening")],
    [
      shortcuts.toggleWindow,
      () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible() && !mainWindow.isMinimized()) mainWindow.hide();
        else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    ],
    [shortcuts.regenerate, () => send("regenerate")],
    [shortcuts.copy, () => send("copy")],
  ];

  for (const [accelerator, handler] of entries) {
    if (!accelerator) continue;
    try {
      globalShortcut.register(accelerator, handler);
    } catch {
      /* invalid or conflicting accelerator - ignored, app keeps working */
    }
  }
}

// ---------- App lifecycle ----------
app.whenReady().then(() => {
  loadEnv();
  applyCsp();
  setupPermissions();

  registerAllIpc((settings: AppSettings) => {
    // Re-register shortcuts when the user changes them in Settings.
    registerShortcuts(settings.shortcuts);
  });

  createWindow();
  registerShortcuts(loadSettings().shortcuts);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Quit fully on all platforms - no lingering background process.
  app.quit();
});

app.on("will-quit", () => {
  cancelActiveAIRequest();
  globalShortcut.unregisterAll();
});
