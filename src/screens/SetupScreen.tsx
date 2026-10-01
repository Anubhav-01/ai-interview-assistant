// Interview setup: resume, job description, interview configuration.
import { useState } from "react";
import { FileUp, FileText, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  Button, Card, CardHeader, CardTitle, CardContent, Input, Textarea, Select, Label, Badge,
} from "@/components/ui";
import { useStore, newSessionId } from "@/lib/store";
import { parseJobDescription, jobSummaryLine } from "@core/jd-parser";
import { resumeSummaryLine } from "@core/resume-parser";
import {
  INTERVIEW_TYPES, LANGUAGES, ANSWER_LENGTHS,
  type InterviewType, type Language, type AnswerLength,
} from "@core/shared/types";

export default function SetupScreen() {
  const store = useStore();
  const { resume, setResume, resumeFileName, setResumeFileName, job, setJob, jobText, setJobText, config, setConfig } = store;
  const [resumeError, setResumeError] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedResume, setPastedResume] = useState("");

  const uploadResume = async () => {
    setResumeError("");
    setResumeLoading(true);
    try {
      const result = await window.api.resume.openAndParse();
      if (result.ok && result.data) {
        setResume(result.data);
        setResumeFileName(result.fileName ?? "resume");
        if (result.data.name && !config.candidateName) {
          setConfig({ ...config, candidateName: result.data.name });
        }
      } else if (result.error && result.error !== "cancelled") {
        setResumeError(result.error);
      }
    } finally {
      setResumeLoading(false);
    }
  };

  const parsePastedResume = async () => {
    setResumeError("");
    const result = await window.api.resume.parseText(pastedResume);
    if (result.ok && result.data) {
      setResume(result.data);
      setResumeFileName("pasted text");
      if (result.data.name && !config.candidateName) {
        setConfig({ ...config, candidateName: result.data.name });
      }
      setPasteMode(false);
    } else {
      setResumeError(result.error ?? "Could not parse the pasted text.");
    }
  };

  const applyJobText = (text: string) => {
    setJobText(text);
    setJob(text.trim() ? parseJobDescription(text) : null);
  };

  const startInterview = () => {
    store.setSession({
      id: newSessionId(),
      createdAt: new Date().toISOString(),
      jobTitle: job?.title ?? "",
      targetRole: config.targetRole,
      interviewType: config.interviewType,
      candidateName: config.candidateName,
      qa: [],
    });
    store.setScreen("interview");
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Interview Setup</h1>
          <p className="text-xs text-muted-foreground">
            Everything below stays on your computer. Only questions + compact context are sent to the AI provider you configured.
          </p>
        </div>

        {/* Resume */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>1 · Resume</CardTitle>
            {resume && (
              <Badge tone="success">
                <CheckCircle2 size={11} /> loaded
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={uploadResume} disabled={resumeLoading} variant="secondary">
                {resumeLoading ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                Upload PDF / DOCX / TXT
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPasteMode((v) => !v)}>
                <FileText size={13} /> paste text instead
              </Button>
              {resume && <span className="text-xs text-muted-foreground">{resumeFileName}</span>}
            </div>

            {pasteMode && (
              <div className="space-y-2">
                <Textarea
                  rows={7}
                  placeholder="Paste your full resume text here…"
                  value={pastedResume}
                  onChange={(e) => setPastedResume(e.target.value)}
                />
                <Button size="sm" onClick={parsePastedResume} disabled={!pastedResume.trim()}>
                  Parse resume text
                </Button>
              </div>
            )}

            {resumeError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle size={13} /> {resumeError}
              </p>
            )}

            {resume && (
              <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                {resumeSummaryLine(resume)}
                {resume.skills.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {resume.skills.slice(0, 12).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                    {resume.skills.length > 12 && <Badge>+{resume.skills.length - 12} more</Badge>}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job description */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>2 · Job Description</CardTitle>
            {job && (
              <Badge tone="success">
                <CheckCircle2 size={11} /> parsed
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              rows={7}
              placeholder="Paste the job description here…"
              value={jobText}
              onChange={(e) => applyJobText(e.target.value)}
            />
            {job && (
              <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                {jobSummaryLine(job)}
                {job.technologies.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {job.technologies.slice(0, 12).map((t) => (
                      <Badge key={t} tone="primary">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>3 · Interview Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <Label>Candidate name</Label>
              <Input
                value={config.candidateName}
                placeholder="Your name"
                onChange={(e) => setConfig({ ...config, candidateName: e.target.value })}
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <Label>Target role</Label>
              <Input
                value={config.targetRole}
                placeholder={job?.title || "e.g. Software Engineer"}
                onChange={(e) => setConfig({ ...config, targetRole: e.target.value })}
              />
            </div>
            <div>
              <Label>Interview type</Label>
              <Select
                value={config.interviewType}
                onChange={(e) => setConfig({ ...config, interviewType: e.target.value as InterviewType })}
              >
                {INTERVIEW_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <Label>Language</Label>
              <Select
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value as Language })}
              >
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </div>
            <div>
              <Label>Answer length</Label>
              <Select
                value={config.answerLength}
                onChange={(e) => setConfig({ ...config, answerLength: e.target.value as AnswerLength })}
              >
                {ANSWER_LENGTHS.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pb-4">
          <p className="text-[11px] text-muted-foreground">
            Resume and JD are optional but strongly improve answer quality.
          </p>
          <Button size="lg" onClick={startInterview}>
            <Play size={16} /> Start Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
