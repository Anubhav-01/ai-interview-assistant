// Custom titlebar: drag region + floating-window controls
// (always-on-top pin, opacity, compact mode, minimize, close).
import { useEffect, useState } from "react";
import { Pin, PinOff, Minus, X, Maximize2, Minimize2, Sun } from "lucide-react";
import { Button } from "./ui";
import { useStore } from "@/lib/store";

export default function TitleBar() {
  const { compact, setCompact, settings, saveSettings } = useStore();
  const [pinned, setPinned] = useState(false);
  const [showOpacity, setShowOpacity] = useState(false);
  const opacity = settings?.appearance.opacity ?? 1;

  useEffect(() => {
    window.api.win.getState().then((s) => setPinned(s.alwaysOnTop)).catch(() => {});
  }, []);

  const togglePin = async () => {
    const result = await window.api.win.setAlwaysOnTop(!pinned);
    setPinned(result);
  };

  const toggleCompact = async () => {
    const result = await window.api.win.setCompact(!compact);
    setCompact(result);
  };

  const changeOpacity = async (v: number) => {
    await window.api.win.setOpacity(v);
    if (settings) {
      await saveSettings({ ...settings, appearance: { ...settings.appearance, opacity: v } });
    }
  };

  return (
    <div className="drag-region flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3 select-none">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
        <span className="h-2 w-2 rounded-full bg-primary" />
        AI Interview Assistant
        <span className="text-[10px] font-normal text-muted-foreground">local · private</span>
      </div>

      <div className="no-drag flex items-center gap-0.5">
        {/* Opacity */}
        <div className="relative">
          <Button variant="ghost" size="icon" title="Window opacity" onClick={() => setShowOpacity((v) => !v)}>
            <Sun size={14} />
          </Button>
          {showOpacity && (
            <div className="absolute right-0 top-9 z-50 rounded-md border border-border bg-card p-3 shadow-lg">
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.05}
                defaultValue={opacity}
                onChange={(e) => changeOpacity(Number(e.target.value))}
                className="w-28"
              />
            </div>
          )}
        </div>

        {/* Compact / expanded */}
        <Button
          variant="ghost"
          size="icon"
          title={compact ? "Expanded mode" : "Compact mode"}
          onClick={toggleCompact}
        >
          {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </Button>

        {/* Always on top */}
        <Button
          variant={pinned ? "secondary" : "ghost"}
          size="icon"
          title={pinned ? "Unpin (always on top: ON)" : "Pin above other windows"}
          onClick={togglePin}
        >
          {pinned ? <Pin size={14} className="text-primary" /> : <PinOff size={14} />}
        </Button>

        <Button variant="ghost" size="icon" title="Minimize" onClick={() => window.api.win.minimize()}>
          <Minus size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Close"
          className="hover:bg-destructive hover:text-white"
          onClick={() => window.api.win.close()}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
