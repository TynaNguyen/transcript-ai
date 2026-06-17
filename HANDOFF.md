# HANDOFF — Transcript AI

> Paste file này vào đầu chat mới để tiếp tục. Đọc CLAUDE.md và ARCHITECTURE.md trước khi code.

---

## Dự án là gì

"Transcript AI" — tool nhận nhiều loại nguồn (YouTube, PDF, web, video, audio, mic) → transcript → meeting minutes report → chat với nội dung. Monorepo npm workspaces.

**Folder:** `/Users/giangnguyen/Claude/Projects/Transcript AI`

**Chạy:** `npm run dev` ở root → Vite (port 5173) + Hono server (port 3001)

---

## Stack

- **Frontend:** React + Vite + Tailwind (`apps/web`)
- **Backend:** Node + Hono + WebSocket (`apps/server`)
- **Shared types/utils:** `packages/shared`
- **LLM:** Gemini 2.5 Flash (via `apps/server/src/llm/router.ts` — DUY NHẤT nơi gọi LLM)
- **STT:** AssemblyAI (via `apps/server/src/stt/adapter.ts` — DUY NHẤT nơi gọi STT)
- **DB:** Supabase (via `apps/server/src/db/client.ts` singleton)
- **Env:** `apps/server/.env` (GEMINI_API_KEY, ASSEMBLYAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY)

---

## Đã xong: Phase 1 — Live Recording ✅

**Flow hoạt động:**
1. User click Start → browser capture mic (+ optional system audio qua getDisplayMedia)
2. ScriptProcessorNode → Float32 PCM → downsample 16kHz → Int16 → base64 → WebSocket `audio_chunk`
3. Server: accumulate buffer ≥1600 bytes (50ms) → `transcriber.sendAudio()` → AssemblyAI v3 streaming
4. AssemblyAI fire `turn` event (`end_of_turn=true/false`) → server gửi `partial_transcript` về client
5. Client hiển thị live, câu final → call `/api/translate/segment` → dịch real-time (nếu chọn ngôn ngữ)
6. User click Stop → server nhận `session_end` → batch STT (WebM file) → Gemini gen meeting minutes
7. Client nhận `session_end` → navigate `/session/:id/report/:reportId`

**Files quan trọng Phase 1:**
```
apps/server/src/
  ingestors/live.ts        — startLiveSession, appendBatchChunk, finalizeLiveSession
  stt/adapter.ts           — AssemblyAI v3 streaming + batch (interface: transcribeFile, streamTranscribe)
  routes/ws.ts             — WebSocket handler
  routes/translate.ts      — POST /api/translate/segment
  report/generator.ts      — Gemini meeting minutes
  llm/router.ts            — gemini-2.5-flash (sensitive/final) + OpenRouter free (draft)

apps/web/src/
  hooks/useLiveRecording.ts   — toàn bộ recording logic + translation state
  pages/LiveRecordingPage.tsx — UI idle/recording/processing/done/error
  pages/ReportPage.tsx        — hiển thị report, nút translate report
  components/LiveTranscriptFeed.tsx — live transcript + translation display
  api/client.ts               — api.sessions / api.report / api.translate
```

**Gotchas đã fix:**
- AssemblyAI v2 deprecated (404) → dùng `client.streaming.transcriber()` v3
- Min chunk 50ms = 1600 bytes tại 16kHz → server-side accumulation buffer
- Double-close ERR_INVALID_STATE → `closeStream()` helper set null trước khi close
- Server crash unhandled rejection → `process.on('unhandledRejection')` + try/catch transcriber.close()
- `exactOptionalPropertyTypes: true` → conditional spread `...(x !== undefined && { x })`
- AssemblyAI streaming KHÔNG hỗ trợ tiếng Việt (chỉ batch mới hỗ trợ)
- `tsx` (no watch) — không dùng `tsx watch` vì server restart mỗi lần save

---

## Đang làm: Phase 2 — Multi-source Ingestors 🔜

**Thứ tự:** YouTube → PDF → Web URL → Video file → Audio file

**Mỗi ingestor trả về `NormalizedContent` (type trong `packages/shared/src/types/`):**
```typescript
interface NormalizedContent {
  sessionId: string
  kind: 'youtube' | 'pdf' | 'web' | 'video' | 'audio' | 'live'
  transcript?: TranscriptSegment[]
  fullText?: string   // cho web/pdf không có transcript
  meta: { title?: string; duration?: number; url?: string; ... }
}
```

**Route chung:** `POST /api/ingest/:type` (đã có trong routes/ingest.ts skeleton nhưng chưa implement)

### YouTube
- Gemini đọc YouTube URL native — không cần tải video
- `fileManager` hoặc inline `{ fileData: { mimeType, fileUri } }` hoặc `inlineData`
- Thực ra Gemini 2.5 Flash nhận URL YouTube trong prompt trực tiếp

### PDF
- Upload file → Gemini Files API → model đọc và extract
- `client.files.upload(buffer, { mimeType: 'application/pdf' })`

### Web URL
- `fetch(url)` → parse HTML với `@mozilla/readability` → clean text → Gemini summarize/structure
- Install: `npm install @mozilla/readability jsdom --workspace=apps/server`

### Video file
- Upload → Gemini Files API (native video) → extract transcript + summary

### Audio file
- Upload → `stt.transcribeFile(filePath)` → same as batch live

---

## Chưa làm

- **Phase 3:** Chat engine (`apps/server/src/chat/engine.ts`) — Gemini với session context
- **Phase 4:** Browser extension — system audio capture (giải pháp cho tiếng Việt và audio từ app khác)
- **Phase 5:** Export (md/docx/pdf), polish UI, session list page

---

## Quy ước bắt buộc (từ CLAUDE.md)

1. **Tìm trước khi viết** — grep `packages/shared/src/` trước khi tạo type/util mới
2. **Types/interfaces** chỉ trong `packages/shared/src/types/`
3. **LLM** chỉ qua `llm/router.ts`, **STT** chỉ qua `stt/adapter.ts`, **DB** chỉ qua `db/client.ts`
4. **API keys** không bao giờ ở frontend
5. **Transcript content** luôn `sensitive: true` khi gọi LLM
6. File > ~200 dòng → tách module
7. Commit format: `feat(phase2): ...`, `fix(stt): ...`
