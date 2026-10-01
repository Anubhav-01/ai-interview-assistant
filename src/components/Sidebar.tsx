import { ClipboardList, MessagesSquare, History, Settings } from "lucide-react";
import { useStore, Screen } from "@/lib/store";
import { cx, Badge } from "./ui";

const ITEMS: Array<{ id: Screen; label: string; icon: React.ReactNode }> = [
  { id: "setup", label: "Setup", icon: <ClipboardList size={16} /> },
  { id: "interview", label: "Interview", icon: <MessagesSquare size={16} /> },
  { id: "history", label: "History", icon: <History size={16} /> },
  { id: "settings", label: "Settings", icon: <Settings size={16} /> },
];

export default function Sidebar() {
  const { screen, setScreen, providerInfo } = useStore();

  return (
    <div className="flex w-44 shrink-0 flex-col border-r border-border bg-card">
      <nav className="flex-1 space-y-0.5 p-2">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className={cx(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              screen === item.id
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-border p-3 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Provider</div>
        {providerInfo ? (
          <Badge tone={providerInfo.isExternal ? (providerInfo.hasKey ? "primary" : "danger") : "success"}>
            {providerInfo.label}
          </Badge>
        ) : (
          <Badge>loading…</Badge>
        )}
        <p className="text-[10px] leading-snug text-muted-foreground">
          {providerInfo?.isExternal
            ? providerInfo.hasKey
              ? "Questions are sent to this external API."
              : "API key missing - add it in Settings."
            : "Offline mode - nothing leaves this computer."}
        </p>
      </div>
    </div>
  );
}
