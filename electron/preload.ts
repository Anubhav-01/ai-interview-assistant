// ============================================================
// Secure preload bridge.
// Exposes ONLY the narrow API the renderer needs - no direct
// Node.js access. contextIsolation is enabled; the renderer
// cannot reach Electron/Node internals.
// ============================================================

import { contextBridge, ipcRenderer } from "electron";

export type ShortcutAction = "toggleListening" | "toggleWindow" | "regenerate" | "copy";

const api = {
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (settings: unknown) => ipcRenderer.invoke("settings:set", settings),
  },
  resume: {
    openAndParse: () => ipcRenderer.invoke("resume:openAndParse"),
    parseText: (text: string) => ipcRenderer.invoke("resume:parseText", text),
  },
  ai: {
    generate: (req: unknown) => ipcRenderer.invoke("ai:generate", req),
    cancel: () => ipcRenderer.invoke("ai:cancel"),
    providerInfo: () => ipcRenderer.invoke("ai:providerInfo"),
  },
  speech: {
    transcribe: (audio: Uint8Array, mimeType: string) =>
      ipcRenderer.invoke("speech:transcribe", audio, mimeType),
  },
  sessions: {
    list: () => ipcRenderer.invoke("sessions:list"),
    save: (session: unknown) => ipcRenderer.invoke("sessions:save", session),
    remove: (id: string) => ipcRenderer.invoke("sessions:delete", id),
    exportSession: (id: string) => ipcRenderer.invoke("sessions:export", id),
  },
  win: {
    minimize: () => ipcRenderer.invoke("win:minimize"),
    close: () => ipcRenderer.invoke("win:close"),
    setAlwaysOnTop: (v: boolean) => ipcRenderer.invoke("win:setAlwaysOnTop", v),
    setOpacity: (v: number) => ipcRenderer.invoke("win:setOpacity", v),
    setCompact: (v: boolean) => ipcRenderer.invoke("win:setCompact", v),
    getState: () => ipcRenderer.invoke("win:getState"),
  },
  clipboard: {
    write: (text: string) => ipcRenderer.invoke("clipboard:write", text),
  },
  /** Subscribe to global-shortcut events from the main process. */
  onShortcut: (cb: (action: ShortcutAction) => void) => {
    const listener = (_evt: unknown, action: ShortcutAction) => cb(action);
    ipcRenderer.on("shortcut", listener);
    return () => ipcRenderer.removeListener("shortcut", listener);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type PreloadApi = typeof api;
