// Session history: local JSON files - view, delete, export.
import { useEffect, useState } from "react";
import { Trash2, Download, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import type { SessionData } from "@core/shared/types";

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setSessions(await window.api.sessions.list());
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    const result = await window.api.sessions.remove(id);
    setMessage(result.ok ? "Session deleted." : result.error ?? "Delete failed.");
    await load();
  };

  const exportSession = async (id: string) => {
    const result = await window.api.sessions.exportSession(id);
    if (result.ok) setMessage(`Exported to ${result.path}`);
    else if (result.error !== "cancelled") setMessage(result.error ?? "Export failed.");
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Session History</h1>
            <p className="text-xs text-muted-foreground">
              Stored locally as JSON files on this computer only.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>

        {message && <p className="text-xs text-muted-foreground">{message}</p>}

        {sessions.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No sessions yet. Start an interview and answered questions will be saved here automatically.
            </CardContent>
          </Card>
        )}

        {sessions.map((s) => {
          const open = expanded === s.id;
          return (
            <Card key={s.id}>
              <button
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                onClick={() => setExpanded(open ? null : s.id)}
              >
                {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">
                    {s.jobTitle || s.targetRole || "Untitled interview"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()} · {s.qa.length} questions
                    {s.candidateName ? ` · ${s.candidateName}` : ""}
                  </div>
                </div>
                <Badge>{s.interviewType || "Mixed"}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Export"
                  onClick={(e) => { e.stopPropagation(); void exportSession(s.id); }}
                >
                  <Download size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                  className="hover:bg-destructive hover:text-white"
                  onClick={(e) => { e.stopPropagation(); void remove(s.id); }}
                >
                  <Trash2 size={14} />
                </Button>
              </button>

              {open && (
                <CardContent className="space-y-3 border-t border-border pt-3">
                  {s.qa.length === 0 && (
                    <p className="text-xs text-muted-foreground">No questions in this session.</p>
                  )}
                  {s.qa.map((pair, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <Badge tone="primary" className="mt-0.5 shrink-0">{pair.questionType}</Badge>
                        <p className="text-sm font-medium">{pair.question}</p>
                      </div>
                      <p className="whitespace-pre-wrap pl-1 text-xs leading-relaxed text-muted-foreground">
                        {pair.answer}
                      </p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
