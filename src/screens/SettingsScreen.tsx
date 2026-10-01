// Settings: AI provider, speech, appearance, shortcuts.
// API keys are stored locally (data/settings.json) and only used
// to call the provider you explicitly select.
import { useEffect, useState } from "react";
import { Save, ShieldCheck, Eye, EyeOff } from "lucide-react";
import {
  Button, Card, CardHeader, CardTitle, CardContent, Input, Select, Label, Badge,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import type { AppSettings, Language } from "@core/shared/types";
import { SPEECH_PROVIDERS } from "@core/speech/provider";

export default function SettingsScreen() {
  const { settings, saveSettings } = useStore();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [message, setMessage] = useState("");
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    if (settings) setDraft(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  if (!draft) return <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>;

  const update = (patch: (d: AppSettings) => void) => {
    const next = JSON.parse(JSON.stringify(draft)) as AppSettings;
    patch(next);
    setDraft(next);
  };

  const save = async () => {
    setMessage("");
    const err = await saveSettings(draft);
    setMessage(err ?? "Settings saved.");
    setTimeout(() => setMessage(""), 3000);
  };

  const keyType = showKeys ? "text" : "password";

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-xs text-muted-foreground">
              Stored locally in <code>data/settings.json</code>. Nothing is sent anywhere except the
              AI/speech provider you pick below.
            </p>
          </div>
          <Button onClick={save}>
            <Save size={14} /> Save
          </Button>
        </div>

        {message && <Badge tone="success">{message}</Badge>}

        {/* AI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>AI Provider</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowKeys((v) => !v)}>
              {showKeys ? <EyeOff size={13} /> : <Eye size={13} />}
              {showKeys ? "hide keys" : "show keys"}
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Provider</Label>
              <Select
                value={draft.ai.provider}
                onChange={(e) => update((d) => { d.ai.provider = e.target.value as AppSettings["ai"]["provider"]; })}
              >
                <option value="mock">Mock (offline, free, for testing)</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </Select>
            </div>
            <div>
              <Label>Temperature ({draft.ai.temperature.toFixed(1)})</Label>
              <input
                type="range" min={0} max={1.5} step={0.1}
                value={draft.ai.temperature}
                onChange={(e) => update((d) => { d.ai.temperature = Number(e.target.value); })}
                className="mt-2 w-full"
              />
            </div>

            {draft.ai.provider === "openai" && (
              <>
                <div>
                  <Label>OpenAI API key</Label>
                  <Input
                    type={keyType}
                    placeholder="sk-…"
                    value={draft.ai.openaiApiKey}
                    onChange={(e) => update((d) => { d.ai.openaiApiKey = e.target.value.trim(); })}
                  />
                </div>
                <div>
                  <Label>OpenAI model</Label>
                  <Input
                    value={draft.ai.openaiModel}
                    onChange={(e) => update((d) => { d.ai.openaiModel = e.target.value.trim(); })}
                  />
                </div>
              </>
            )}

            {draft.ai.provider === "gemini" && (
              <>
                <div>
                  <Label>Gemini API key</Label>
                  <Input
                    type={keyType}
                    placeholder="AIza…"
                    value={draft.ai.geminiApiKey}
                    onChange={(e) => update((d) => { d.ai.geminiApiKey = e.target.value.trim(); })}
                  />
                </div>
                <div>
                  <Label>Gemini model</Label>
                  <Input
                    value={draft.ai.geminiModel}
                    onChange={(e) => update((d) => { d.ai.geminiModel = e.target.value.trim(); })}
                  />
                </div>
              </>
            )}

            {draft.ai.provider !== "mock" && (
              <p className="col-span-full text-[11px] text-muted-foreground">
                When this provider is active, interview questions plus a compact resume/JD context are
                sent to its API. Keys can also be set via a local <code>.env</code> file.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Speech */}
        <Card>
          <CardHeader><CardTitle>Speech-to-Text</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Provider</Label>
              <Select
                value={draft.speech.provider}
                onChange={(e) => update((d) => { d.speech.provider = e.target.value as AppSettings["speech"]["provider"]; })}
              >
                {SPEECH_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {SPEECH_PROVIDERS.find((p) => p.id === draft.speech.provider)?.description}
              </p>
            </div>
            <div>
              <Label>Language</Label>
              <Select
                value={draft.speech.language}
                onChange={(e) => update((d) => { d.speech.language = e.target.value as Language; })}
              >
                <option>English</option>
                <option>Hindi</option>
                <option>Hinglish</option>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Microphone selection follows your Windows default input device.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Theme</Label>
              <Select
                value={draft.appearance.theme}
                onChange={(e) => update((d) => { d.appearance.theme = e.target.value as "dark" | "light"; })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </Select>
            </div>
            <div>
              <Label>Font size ({draft.appearance.fontSize}px)</Label>
              <input
                type="range" min={12} max={20} step={1}
                value={draft.appearance.fontSize}
                onChange={(e) => update((d) => { d.appearance.fontSize = Number(e.target.value); })}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <Label>Window opacity ({Math.round(draft.appearance.opacity * 100)}%)</Label>
              <input
                type="range" min={0.4} max={1} step={0.05}
                value={draft.appearance.opacity}
                onChange={(e) => update((d) => { d.appearance.opacity = Number(e.target.value); })}
                className="mt-2 w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Shortcuts */}
        <Card>
          <CardHeader><CardTitle>Keyboard Shortcuts (global)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ["toggleListening", "Start / stop listening"],
                ["toggleWindow", "Show / hide window"],
                ["regenerate", "Regenerate answer"],
                ["copy", "Copy answer"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  value={draft.shortcuts[key]}
                  onChange={(e) => update((d) => { d.shortcuts[key] = e.target.value; })}
                  placeholder="e.g. CommandOrControl+Shift+Space"
                />
              </div>
            ))}
            <p className="col-span-full text-[11px] text-muted-foreground">
              Use Electron accelerator syntax, e.g. <code>CommandOrControl+Shift+R</code>. Invalid or
              conflicting shortcuts are skipped safely. <code>Esc</code> always acts as a quick STOP inside the app.
            </p>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
          <CardContent className="flex items-start gap-2.5 text-xs text-muted-foreground">
            <ShieldCheck size={26} className="shrink-0 text-accent" />
            <p>
              This app has no accounts, no analytics, no tracking and no remote database. Your resume,
              job descriptions, settings and session history are stored only on this computer. The only
              network traffic is to the AI/speech provider you explicitly configure above - and none at
              all in Mock mode.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
