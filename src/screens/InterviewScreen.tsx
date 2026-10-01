// Interview workspace: listen -> transcribe -> classify -> ground -> answer.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic, MicOff, Copy, RefreshCw, Minimize2, Wand2, OctagonX, Send, Check, Loader2,
} from "lucide-react";
import { Button, Card, CardHeader, CardTitle, CardContent, Textarea, Badge, cx } from "@/components/ui";
import { useStore, newSessionId } from "@/lib/store";
import { useSpeech } from "@/hooks/useSpeech";
import { classifyQuestion } from "@core/classifier";
import {
  buildCandidateContext, buildConversationContext, buildJobContext,
} from "@core/context-engine";
import {
  emptyJob, emptyResume,
  type AnswerModifier, type AssistantStatus, type QAPair, type QuestionType,
} from "@core/shared/types";

const STATUS_LABEL: Record<AssistantStatus, string> = {
  idle: "Ready",
  listening: "Listening…",
  transcribing: "Transcribing…",
  understanding: "Understanding…",
  generating: "Generating answer…",
  ready: "Ready",
  error: "Error",
};

export default function InterviewScreen() {
  const store = useStore();
  const { settings, resume, job, config, session, setSession, compact, providerInfo } = store;

  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("GENERAL");
  const [answer, setAnswer] = useState("");
  const [genStatus, setGenStatus] = useState<AssistantStatus>("idle");
  const [error, setError] = useState("");
  const [manualText, setManualText] = useState("");
  const [copied, setCopied] = useState(false);
  const historyRef = useRef<QAPair[]>(session?.qa ?? []);
  const generatingRef = useRef(false);

  // ---------- answer generation ----------
  const generate = useCallback(
    async (q: string, modifier?: AnswerModifier) => {
      const text = q.trim();
      if (!text) {
        setError("Empty question - type or speak a question first.");
        return;
      }
      setError("");
      setQuestion(text);
      setGenStatus("understanding");
      generatingRef.current = true;

      // classification happens locally (no API call)
      const isModifier = !!modifier;
      const historyForContext = isModifier
        ? historyRef.current.slice(0, -1)
        : historyRef.current;
      const qType = classifyQuestion(text, historyForContext.length > 0);
      setQuestionType(qType);

      // resume grounding + compact contexts
      const req = {
        question: text,
        questionType: qType,
        candidateContext: buildCandidateContext(resume ?? emptyResume(), text, job?.keywords ?? []),
        jobContext: buildJobContext(job ?? emptyJob()),
        conversationContext: buildConversationContext(historyForContext),
        interviewType: config.interviewType,
        targetRole: config.targetRole || job?.title || "",
        language: config.language,
        answerLength: config.answerLength,
        modifier,
      };

      setGenStatus("generating");
      const result = await window.api.ai.generate(req);
      generatingRef.current = false;

      if (!result.ok || !result.answer) {
        if (result.error === "Cancelled." || result.error === "Request cancelled.") {
          setGenStatus("idle");
          return;
        }
        setError(result.error ?? "The AI returned no answer.");
        setGenStatus("error");
        return;
      }

      setAnswer(result.answer);
      setGenStatus("ready");

      // update history + persist session
      const pair: QAPair = { question: text, answer: result.answer, questionType: qType, timestamp: Date.now() };
      const nextQa = isModifier ? [...historyRef.current.slice(0, -1), pair] : [...historyRef.current, pair];
      historyRef.current = nextQa;

      const current = session ?? {
        id: newSessionId(),
        createdAt: new Date().toISOString(),
        jobTitle: job?.title ?? "",
        targetRole: config.targetRole,
        interviewType: config.interviewType,
        candidateName: config.candidateName,
        qa: [],
      };
      const updated = { ...current, qa: nextQa };
      setSession(updated);
      window.api.sessions.save(updated).catch(() => {});
    },
    [resume, job, config, session, setSession]
  );

  // ---------- speech pipeline ----------
  const speech = useSpeech({
    provider: settings?.speech.provider ?? "mock",
    language: settings?.speech.language ?? "English",
    onQuestion: (q) => void generate(q),
    onError: (msg) => {
      setError(msg);
      setGenStatus("error");
    },
  });

  // ---------- emergency stop ----------
  const stopAll = useCallback(() => {
    speech.stop();
    window.api.ai.cancel().catch(() => {});
    generatingRef.current = false;
    setGenStatus("idle");
    setError("");
  }, [speech]);

  // ---------- actions ----------
  const copyAnswer = useCallback(async () => {
    if (!answer) return;
    await window.api.clipboard.write(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [answer]);

  const regenerate = useCallback(
    (modifier: AnswerModifier = "regenerate") => {
      if (question) void generate(question, modifier);
    },
    [question, generate]
  );

  // global shortcuts from main process
  useEffect(() => {
    const unsub = window.api.onShortcut((action) => {
      if (action === "toggleListening") speech.toggle();
      else if (action === "regenerate") regenerate();
      else if (action === "copy") void copyAnswer();
    });
    return unsub;
  }, [speech.toggle, regenerate, copyAnswer]);

  // Esc = quick stop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopAll]);

  // overall pipeline status shown to the user
  const status: AssistantStatus = useMemo(() => {
    if (generatingRef.current || genStatus === "understanding" || genStatus === "generating") return genStatus;
    if (speech.status === "transcribing") return "transcribing";
    if (speech.listening) return "listening";
    return genStatus === "error" ? "error" : genStatus;
  }, [genStatus, speech.status, speech.listening]);

  const busy = status === "understanding" || status === "generating" || status === "transcribing";

  const submitManual = () => {
    if (manualText.trim()) {
      void generate(manualText);
      setManualText("");
    }
  };

  return (
    <div className={cx("flex h-full flex-col gap-2.5 overflow-y-auto", compact ? "p-2" : "p-4")}>
      {/* Status / controls bar */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant={speech.listening ? "success" : "secondary"}
          size={compact ? "sm" : "md"}
          onClick={speech.toggle}
          title="Ctrl+Shift+Space"
        >
          {speech.listening ? <Mic size={15} className="listening-dot" /> : <MicOff size={15} />}
          {speech.listening ? "Listening" : "Start Listening"}
        </Button>

        <Badge
          tone={status === "error" ? "danger" : busy ? "warning" : speech.listening ? "success" : "muted"}
          className="min-w-[110px] justify-center"
        >
          {busy && <Loader2 size={11} className="animate-spin" />}
          {STATUS_LABEL[status]}
        </Badge>

        {settings?.speech.provider === "mock" && (
          <span className="hidden text-[10px] text-muted-foreground sm:block">
            mock speech: sample questions will appear automatically
          </span>
        )}

        <div className="flex-1" />

        <Button variant="destructive" size={compact ? "sm" : "md"} onClick={stopAll} title="Esc">
          <OctagonX size={15} /> STOP
        </Button>
      </div>

      {error && (
        <div className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Current question */}
      <Card className="shrink-0">
        <CardHeader className="flex flex-row items-center justify-between py-2">
          <CardTitle>Current Question</CardTitle>
          {question && <Badge tone="primary">{questionType}</Badge>}
        </CardHeader>
        <CardContent>
          <p className={cx("font-medium leading-snug", compact ? "text-sm" : "text-base")}>
            {question || (
              <span className="text-muted-foreground font-normal text-sm">
                Speak a question or type one below…
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Suggested answer */}
      <Card className="flex min-h-[120px] flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between py-2">
          <CardTitle>Suggested Answer</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={!answer} onClick={copyAnswer} title="Ctrl+Shift+C">
              {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />} Copy
            </Button>
            <Button variant="ghost" size="sm" disabled={!question || busy} onClick={() => regenerate("regenerate")} title="Ctrl+Shift+R">
              <RefreshCw size={13} /> Regenerate
            </Button>
            <Button variant="ghost" size="sm" disabled={!question || busy} onClick={() => regenerate("shorter")}>
              <Minimize2 size={13} /> Shorter
            </Button>
            <Button variant="ghost" size="sm" disabled={!question || busy} onClick={() => regenerate("simpler")}>
              <Wand2 size={13} /> Simpler
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {answer ? (
            <AnswerBody text={answer} compact={compact} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {busy ? "Working on it…" : "The suggested answer will appear here."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual input - always available fallback */}
      <div className="flex shrink-0 items-end gap-2">
        <Textarea
          rows={compact ? 1 : 2}
          placeholder="Type interviewer question…  (Enter to generate, Shift+Enter for newline)"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitManual();
            }
          }}
        />
        <Button onClick={submitManual} disabled={!manualText.trim() || busy} className="shrink-0">
          <Send size={14} /> Generate Answer
        </Button>
      </div>

      {/* live transcript hint */}
      {speech.listening && speech.lastTranscript && (
        <p className="shrink-0 truncate text-[10px] text-muted-foreground">
          Last transcript: “{speech.lastTranscript}”
        </p>
      )}
      {providerInfo?.isExternal && (
        <p className="shrink-0 text-[10px] text-muted-foreground">
          Note: questions and compact resume/JD context are sent to {providerInfo.label}.
        </p>
      )}
    </div>
  );
}

/** Lightweight renderer: supports ``` code blocks without a markdown lib. */
function AnswerBody({ text, compact }: { text: string; compact: boolean }) {
  const parts = text.split(/```(\w*)\n?/);
  // parts: [text, lang, code, text, lang, code, ...]
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i].trim()) {
        nodes.push(
          parts[i].split(/\n{2,}/).map((para, j) => (
            <p key={`${i}-${j}`} className="whitespace-pre-wrap">
              {para}
            </p>
          ))
        );
      }
    } else if (i % 3 === 2) {
      nodes.push(
        <pre key={i}>
          <code>{parts[i].replace(/\n$/, "")}</code>
        </pre>
      );
    }
  }
  return (
    <div className={cx("answer-body leading-relaxed", compact ? "text-sm" : "text-[0.95rem]")}>
      {nodes}
    </div>
  );
}
