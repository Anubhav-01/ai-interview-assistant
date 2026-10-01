// ============================================================
// IPC registration hub. All handlers validate their inputs.
// ============================================================

import { ipcMain, clipboard } from "electron";
import { loadSettings, saveSettings } from "./settings";
import { registerAIHandlers } from "./ai";
import { registerResumeHandlers } from "./resume";
import { registerSessionHandlers } from "./sessions";
import { registerSpeechHandlers } from "./speech";
import { registerWindowHandlers } from "./window";
import type { AppSettings } from "../../core/shared/types";

export function registerAllIpc(onSettingsChanged: (s: AppSettings) => void) {
  ipcMain.handle("settings:get", async () => loadSettings());

  ipcMain.handle("settings:set", async (_evt, raw: unknown) => {
    try {
      const saved = saveSettings(raw as AppSettings);
      onSettingsChanged(saved);
      return { ok: true, settings: saved };
    } catch (err: any) {
      return { ok: false, error: `Could not save settings: ${err?.message}` };
    }
  });

  ipcMain.handle("clipboard:write", async (_evt, text: unknown) => {
    if (typeof text === "string") clipboard.writeText(text.slice(0, 100000));
    return { ok: true };
  });

  registerAIHandlers();
  registerResumeHandlers();
  registerSessionHandlers();
  registerSpeechHandlers();
  registerWindowHandlers();
}
