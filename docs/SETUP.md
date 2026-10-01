# Setup Guide (share this with friends)

A 5-minute guide to run the AI Interview Assistant on your own Windows computer.
No server, no account, no subscription - only your own API key.

## 1. Install Node.js

Download and install the LTS version from <https://nodejs.org>.

## 2. Get the project

Either clone it:

```bat
git clone https://github.com/Anubhav-01/ai-interview-assistant.git
cd ai-interview-assistant
```

or download the ZIP, extract it, and open the folder.

## 3. Start the app

Double-click **`start.bat`** (or run it from a terminal).
The first run installs dependencies and builds the app; later runs start instantly.

## 4. Add your API key

The app starts in **Mock mode** - it works immediately without any key, using canned answers, so you can explore the UI for free.

For real AI answers:

1. Get a key:
   - OpenAI: <https://platform.openai.com/api-keys>
   - Google Gemini (has a free tier): <https://aistudio.google.com/apikey>
2. In the app, open **Settings → AI Provider**, pick your provider, paste your key, click **Save**.

Alternatively, copy `.env.example` to `.env` and put the key there.
**Never share or commit your `.env` file.**

## 5. Set up speech (optional)

In **Settings → Speech-to-Text**:

| Provider | Needs | Notes |
|---|---|---|
| Whisper | OpenAI API key | Most accurate. Records locally, transcribes finished phrases via the Whisper API. |
| Browser | nothing | May be unavailable in some Electron builds; the app tells you and keeps working. |
| Mock | nothing | Emits sample questions - great for a demo. |

If Windows blocks the microphone: **Windows Settings → Privacy & security → Microphone → allow desktop apps**.

## 6. Run an interview

1. **Setup** tab → upload your resume (PDF/DOCX/TXT) → paste the job description → choose interview type, language, answer length.
2. Click **Start Interview**.
3. Click **Start Listening** and let the interviewer's question be heard - or type any question manually.
4. Read the suggested answer. Use **Copy / Regenerate / Shorter / Simpler** as needed.
5. Press the red **STOP** button (or `Esc`) to instantly stop the mic and any pending AI request.

## Default keyboard shortcuts (global)

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Space` | Start/stop listening |
| `Ctrl+Shift+H` | Show/hide the window |
| `Ctrl+Shift+R` | Regenerate answer |
| `Ctrl+Shift+C` | Copy answer |
| `Esc` (in-app) | Emergency stop |

All of these can be changed in **Settings → Keyboard Shortcuts**.

## Where is my data?

- Dev/`start.bat` runs: `<project>/data/` (settings + sessions as JSON)
- Installed build: `%APPDATA%/AI Interview Assistant/data/`

Delete those folders to wipe everything. Nothing is stored anywhere else.
