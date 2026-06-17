# ARCHITECTURE.md — Bản đồ kiến trúc Transcript Tool

> **Đọc file này trước khi sửa hoặc thêm bất kỳ module nào.** Mục đích: hiểu code đang có, tránh tạo trùng lặp.

---

## 1. Pipeline tổng quan

```
NGUỒN (6 loại)
    │
    ▼
┌─────────────────────────────┐
│   INGESTOR LAYER            │  apps/server/src/ingestors/
│   youtube | pdf | web |     │  → Mỗi ingestor nhận input riêng
│   video   | audio | live    │  → Trả về NormalizedContent (type chung)
└─────────────┬───────────────┘
              │ NormalizedContent
              ▼
┌─────────────────────────────┐
│   PROCESSING LAYER          │
│  ┌──────────────────────┐   │
│  │  Report Generator    │   │  apps/server/src/report/
│  │  (dùng LLM Router)   │   │  → Nhận NormalizedContent → Markdown report
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │  Chat Engine         │   │  apps/server/src/chat/
│  │  (Gemini context)    │   │  → Nhận session_id → Answer câu hỏi
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │  Translator          │   │  apps/server/src/report/ (translate.ts)
│  │  (Gemini batch)      │   │  → Dịch report/transcript, giữ cấu trúc
│  └──────────────────────┘   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   EXPORT LAYER              │  apps/server/src/export/
│   md | docx | pdf           │
└─────────────────────────────┘
```

---

## 2. Modules và trách nhiệm

### `packages/shared` — Dùng chung
| File | Trách nhiệm |
|------|-------------|
| `src/types/index.ts` | Tất cả TypeScript types/interfaces |
| `src/constants/index.ts` | Enums, magic strings, giới hạn |
| `src/utils/` | Pure functions (format time, parse text...) |

### `apps/server/src/ingestors/` — Cổng vào
| File | Xử lý nguồn | Notes |
|------|-------------|-------|
| `youtube.ts` | URL YouTube | Dùng Gemini native URL |
| `pdf.ts` | File PDF | Gửi thẳng cho Gemini |
| `web.ts` | URL website | Fetch + Readability |
| `video.ts` | File video | Gemini hoặc tách audio → STT |
| `audio.ts` | File audio | STT batch (có diarization) |
| `live.ts` | Mic + system audio realtime | WebSocket + STT stream |

**Output chung của mọi ingestor:** `NormalizedContent`

### `apps/server/src/llm/router.ts` — Bộ não
- **DUY NHẤT** nơi gọi Gemini/OpenRouter
- Routing theo `tier` và `sensitive`
- Fallback tự động khi rate-limit
- **KHÔNG gọi LLM trực tiếp ở bất kỳ nơi nào khác**

### `apps/server/src/stt/adapter.ts` — Tai nghe
- **DUY NHẤT** nơi tích hợp STT provider
- Interface: `transcribeFile()` + `streamTranscribe()`
- Hiện tại: AssemblyAI / Deepgram (cấu hình qua env)
- **KHÔNG gọi STT SDK trực tiếp ở nơi khác**

### `apps/server/src/db/client.ts` — Lưu trữ
- Singleton Supabase client
- **KHÔNG tạo Supabase client ở bất kỳ nơi nào khác**

### `apps/server/src/report/`
| File | Trách nhiệm |
|------|-------------|
| `generator.ts` | Sinh báo cáo từ NormalizedContent, gọi llm.complete() |
| `templates.ts` | Prompt templates (meeting minutes + content report) |
| `translate.ts` | Dịch report/transcript sang ngôn ngữ khác (Phase 2.5) |

### `apps/server/src/routes/`
| File | Endpoints |
|------|-----------|
| `sessions.ts` | CRUD sessions |
| `ingest.ts` | POST /ingest/:type |
| `report.ts` | POST /report/generate, POST /report/translate |
| `chat.ts` | POST /chat (HTTP) |
| `export.ts` | GET /export/:sessionId/:format |
| `ws.ts` | WebSocket handler cho live recording |

---

## 3. Data flow chi tiết — Live Recording

```
Browser (Mic + System Audio)
    │ MediaStream
    ├─[Web Audio API]─► Mix thành 1 stream
    │
    │ PCM chunks (WebSocket)
    ▼
apps/server/src/routes/ws.ts
    │
    ├─► stt/adapter.ts (streamTranscribe) ──► PartialTranscript
    │       │                                      │
    │       ▼                                      ▼ (WebSocket back)
    │   Ghi audio vào tmp file              Browser hiển thị live
    │
    └─[khi Stop]─► stt/adapter.ts (transcribeFile)  ← batch re-process
                        │
                        ▼
                   TranscriptSegment[]
                        │
                        ▼
                   db: transcripts table
                        │
                        ▼
                   report/generator.ts (meeting minutes template)
                        │
                        ▼
                   db: reports table → stream về browser
```

---

## 4. Database schema (Supabase/Postgres)

```sql
-- Xem file: apps/server/src/db/schema.sql
sessions       (id, type, title, status, created_at, language_detected)
sources        (id, session_id, kind, url, file_path, meta)
transcripts    (id, session_id, segments JSONB, raw_text, language)
reports        (id, session_id, template, content_md, created_at)
chat_messages  (id, session_id, role, content, created_at)
speakers       (id, session_id, label, display_name)
translations   (id, report_id|transcript_id, target_lang, content, created_at)
```

---

## 5. Quyết định kỹ thuật quan trọng

| Quyết định | Lý do |
|------------|-------|
| Mọi LLM call qua `llm/router.ts` | Đổi model/provider chỉ sửa 1 chỗ |
| STT qua `stt/adapter.ts` interface | Test nhiều provider không sửa ingestor |
| Gemini đọc YouTube URL native | Không cần tải video về |
| 2-pass strategy cho live | Real-time UX + batch accuracy |
| Keys chỉ ở backend | Bảo mật: không bao giờ lộ ra client |
| `NormalizedContent` type chung | 6 ingestor → 1 pipeline, không viết lại |

---

## 6. Trạng thái hiện tại

### ✅ Phase 1 — Live Recording (DONE)

**Backend:**
- `apps/server/src/ingestors/live.ts` — startLiveSession / appendBatchChunk / finalizeLiveSession
- `apps/server/src/stt/adapter.ts` — AssemblyAI v3 streaming (`client.streaming.transcriber()`) + batch
- `apps/server/src/routes/ws.ts` — WebSocket handler, PCM streaming → STT → partial_transcript
- `apps/server/src/routes/translate.ts` — POST /api/translate/segment (per-sentence real-time translation)
- `apps/server/src/report/generator.ts` — Gemini meeting minutes from NormalizedContent
- `apps/server/src/llm/router.ts` — Gemini 2.5 Flash (sensitive/final) + OpenRouter free (draft)

**Frontend:**
- `apps/web/src/hooks/useLiveRecording.ts` — full recording flow, live lines, real-time translation
- `apps/web/src/pages/LiveRecordingPage.tsx` — UI: idle/recording/processing/done/error states
- `apps/web/src/components/LiveTranscriptFeed.tsx` — live scrolling transcript + translation display
- `apps/web/src/components/Waveform.tsx` — audio level visualizer
- `apps/web/src/pages/ReportPage.tsx` — hiển thị meeting minutes, translate report
- `apps/web/src/api/client.ts` — apiFetch wrapper, api.sessions / api.report / api.translate

**Key decisions Phase 1:**
- AssemblyAI v3 streaming (v2 deprecated/404)
- 2-pass: streaming PCM → realtime UX, MediaRecorder WebM → batch accuracy sau Stop
- Server-side audio buffer 1600 bytes (50ms min chunk AssemblyAI requirement)
- `minTurnSilence: 300`, `endOfTurnConfidenceThreshold: 0.6` → tách câu nhanh hơn
- AssemblyAI streaming KHÔNG hỗ trợ tiếng Việt (chỉ batch mới hỗ trợ)
- Real-time translation per sentence qua `/api/translate/segment` (Gemini)

### 🔜 Phase 2 — Multi-source Ingestors (NEXT)

Thứ tự ưu tiên: YouTube → PDF → Web URL → Video file → Audio file

Mỗi ingestor trả về `NormalizedContent` — Report generator và Chat engine KHÔNG cần thay đổi.

**YouTube ingestor** (`apps/server/src/ingestors/youtube.ts`):
- Gemini native URL support: `fileManager.uploadFile()` hoặc inline URL part
- Gemini có thể đọc YouTube URL trực tiếp → không cần tải video
- Route: POST /api/ingest/youtube { url }

**PDF ingestor** (`apps/server/src/ingestors/pdf.ts`):
- Upload file → Gemini Files API → extract text/structure
- Route: POST /api/ingest/pdf (multipart form)

**Web URL ingestor** (`apps/server/src/ingestors/web.ts`):
- Fetch HTML → @mozilla/readability → clean text → Gemini summarize
- Route: POST /api/ingest/web { url }

**Video file ingestor** (`apps/server/src/ingestors/video.ts`):
- Upload → Gemini Files API (native video support)
- Route: POST /api/ingest/video (multipart form)

**Audio file ingestor** (`apps/server/src/ingestors/audio.ts`):
- Upload → stt.transcribeFile() → NormalizedContent
- Route: POST /api/ingest/audio (multipart form)

### 📋 Phase 3 — Chat (TODO)
### 📋 Phase 4 — Browser Extension (TODO)
### 📋 Phase 5 — Polish + Export (TODO)
