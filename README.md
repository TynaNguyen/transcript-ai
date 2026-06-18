# Transcript AI

Record meetings, import videos/PDFs/web pages — get instant transcripts, summaries, and meeting minutes. Powered by your own Gemini API key.

## Download

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon M1/M2/M3) | [**Download .dmg (arm64)**](https://github.com/TynaNguyen/transcript-ai/releases/latest) |
| macOS (Intel) | [**Download .dmg (x64)**](https://github.com/TynaNguyen/transcript-ai/releases/latest) |
| Windows | [**Download .exe**](https://github.com/TynaNguyen/transcript-ai/releases/latest) |
| Linux | [**Download .AppImage / .deb**](https://github.com/TynaNguyen/transcript-ai/releases/latest) |

**First launch:** The app will ask for your [Google Gemini API key](https://aistudio.google.com/apikey). Your data stays on your machine — nothing is sent to our servers.

## Features

- **Live recording** — real-time transcript with speaker detection, auto-translate
- **Import sources** — YouTube, PDF, website, video/audio files
- **AI reports** — meeting minutes, action items, key takeaways
- **Chat** — ask questions about the transcript
- **Local storage** — all data saved to `~/.transcript-ai/` on your machine

## Stack

- **Desktop:** Electron (macOS · Windows · Linux)
- **Frontend:** React + Vite + Tailwind
- **Backend:** Hono + WebSocket (runs locally inside the app)
- **STT:** AssemblyAI / Deepgram / Gemini STT (your choice)
- **LLM:** Google Gemini 2.5 Flash

---

## For developers — run from source

```bash
# Prerequisites: Node.js 20+, npm 10+

# 1. Install dependencies
npm install

# 2. Copy env template and fill in your keys
cp .env.example .env

# 3. Run (web + server together)
npm run dev
# Web: http://localhost:5173  |  API: http://localhost:3001
```

### Release a new version

```bash
# Bump version in apps/desktop/package.json, then:
git tag v1.x.x
git push && git push --tags
# GitHub Actions builds and publishes automatically
```

### For MacOS

```bash
Open your terminal and type this to bypass the gatekeeper
xattr -cr "/Applications/Transcript AI.app"
```


