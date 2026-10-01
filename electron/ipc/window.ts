// ============================================================
// Window IPC: floating-window behaviour.
// Always-on-top, opacity, compact/expanded mode, minimize/close.
// The app behaves as a normal desktop window and is always
// visible in Task Manager - no hiding or evasion of any kind.
// ============================================================

import { ipcMain, BrowserWindow } from "electron";

interface WindowModeState {
  compact: boolean;
  prevBounds?: Electron.Rectangle;
}

const state = new WeakMap<BrowserWindow, WindowModeState>();

const COMPACT_SIZE = { width: 460, height: 340 };

function winOf(evt: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(evt.sender);
}

export function registerWindowHandlers() {
  ipcMain.handle("win:minimize", (evt) => {
    winOf(evt)?.minimize();
  });

  ipcMain.handle("win:close", (evt) => {
    winOf(evt)?.close();
  });

  ipcMain.handle("win:setAlwaysOnTop", (evt, value: unknown) => {
    const win = winOf(evt);
    if (!win) return false;
    win.setAlwaysOnTop(value === true, "floating");
    return win.isAlwaysOnTop();
  });

  ipcMain.handle("win:setOpacity", (evt, value: unknown) => {
    const win = winOf(evt);
    if (!win) return;
    const n = typeof value === "number" && Number.isFinite(value) ? value : 1;
    win.setOpacity(Math.min(1, Math.max(0.4, n)));
  });

  ipcMain.handle("win:setCompact", (evt, value: unknown) => {
    const win = winOf(evt);
    if (!win) return false;
    const s = state.get(win) ?? { compact: false };
    const wantCompact = value === true;
    if (wantCompact && !s.compact) {
      s.prevBounds = win.getBounds();
      win.setMinimumSize(380, 260);
      win.setSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
      s.compact = true;
    } else if (!wantCompact && s.compact) {
      win.setMinimumSize(720, 520);
      if (s.prevBounds) win.setBounds(s.prevBounds);
      else win.setSize(1080, 720);
      s.compact = false;
    }
    state.set(win, s);
    return s.compact;
  });

  ipcMain.handle("win:getState", (evt) => {
    const win = winOf(evt);
    if (!win) return { alwaysOnTop: false, compact: false, opacity: 1 };
    return {
      alwaysOnTop: win.isAlwaysOnTop(),
      compact: state.get(win)?.compact ?? false,
      opacity: win.getOpacity(),
    };
  });
}
