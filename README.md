# Transcript Tool — Setup & Run

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (schema đã có ở `apps/server/src/db/schema.sql`)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Cấu hình env (đã có sẵn .env — điền giá trị thật vào)
# Đảm bảo có: GEMINI_API_KEY, ASSEMBLYAI_API_KEY, SUPABASE_*

# 3. Chạy schema trong Supabase
# Mở Supabase Dashboard > SQL Editor > paste nội dung apps/server/src/db/schema.sql

# 4. Run (cả web + server cùng lúc)
npm run dev
```

Web chạy trên: http://localhost:5173
Server chạy trên: http://localhost:3001

## Phase 1 — Live Recording (đã implement)

- `/` — Home, chọn nguồn
- `/live` — Live recording page
- `/session/:id/report/:reportId` — Report page

## Stack

- **Web:** React + Vite + Tailwind
- **Server:** Hono + WebSocket + Node
- **STT:** AssemblyAI (batch + streaming)
- **LLM:** Google Gemini 1.5 Flash
- **DB:** Supabase (Postgres)
