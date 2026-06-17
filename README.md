# Transcript AI

Record meetings, import videos/PDFs/web pages — get instant transcripts, summaries, and meeting minutes. Powered by your own Gemini API key.

## Download

Go to **[Releases](https://github.com/TynaNguyen/transcript-ai/releases/latest)** and pick the file for your OS:

| Platform | File to download |
|----------|-----------------|
| macOS (Apple Silicon) | `Transcript AI-x.x.x-arm64.dmg` |
| macOS (Intel) | `Transcript AI-x.x.x.dmg` |
| Windows | `Transcript AI Setup x.x.x.exe` |
| Linux | `Transcript AI-x.x.x.AppImage` or `.deb` |

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
