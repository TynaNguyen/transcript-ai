# CLAUDE.md — Quy ước & Luật của dự án Transcript Tool

> **Đọc file này TRƯỚC KHI viết bất kỳ dòng code nào.** Đây là nguồn sự thật duy nhất về cách code trong repo này.

---

## 1. Triết lý cốt lõi

Toàn bộ dự án là **1 pipeline duy nhất** với nhiều "cửa vào":

```
NGUỒN (youtube/pdf/web/video/audio/live)
  → Ingestor (chuẩn hóa về NormalizedContent)
  → [Report Generator | Chat Engine | Export]
```

**Hệ quả:** KHÔNG bao giờ viết lại logic report/chat/export cho từng loại nguồn. Mọi ingestor đều trả về cùng 1 kiểu `NormalizedContent`. Thêm nguồn mới = viết thêm 1 ingestor, không đụng vào phần còn lại.

---

## 2. Luật chống code rác (BẮT BUỘC)

### 2.1 Tìm trước khi viết
Trước khi tạo hàm/component/hook/util mới:
1. Tìm trong `packages/shared/src/` xem đã có tương tự chưa
2. Tìm trong cùng package (`apps/web/src/`, `apps/server/src/`)
3. Nếu đã có → **tái dùng hoặc mở rộng**, không tạo bản copy

### 2.2 Một nguồn sự thật
- **Types/interfaces:** chỉ định nghĩa trong `packages/shared/src/types/`
- **Constants:** chỉ trong `packages/shared/src/constants/`
- **Config/env:** backend đọc từ `apps/server/src/config.ts`, frontend từ `apps/web/src/config.ts`
- **TUYỆT ĐỐI không copy-paste type/constant từ file này sang file khác**

### 2.3 Khi sửa tính năng
- **Đọc code hiện có trước** — dùng Read/Grep để hiểu logic đang có
- **Sửa code hiện có**, không tạo file/hàm song song trùng chức năng
- Nếu thay thế hoàn toàn → **xóa code cũ**, không comment out, không để dead code

### 2.4 Giới hạn kích thước
- File > ~200 dòng → tách thành module nhỏ hơn
- Hàm làm đúng 1 việc, tên mô tả việc đó
- Component React: 1 file = 1 component chính (sub-components cùng file nếu nhỏ)

---

## 3. Cấu trúc thư mục

```
transcript-tool/
├── apps/
│   ├── web/                    # React + Vite + Tailwind
│   │   └── src/
│   │       ├── components/     # UI components (tái dùng)
│   │       ├── pages/          # Route-level pages
│   │       ├── hooks/          # Custom React hooks
│   │       ├── stores/         # State management (Zustand)
│   │       ├── api/            # API client calls (chỉ gọi backend của mình)
│   │       └── config.ts       # Env vars (VITE_*)
│   │
│   ├── server/                 # Node + Hono + WebSocket
│   │   └── src/
│   │       ├── ingestors/      # 1 file per source type
│   │       │   ├── youtube.ts
│   │       │   ├── pdf.ts
│   │       │   ├── web.ts
│   │       │   ├── video.ts
│   │       │   ├── audio.ts
│   │       │   └── live.ts
│   │       ├── llm/
│   │       │   └── router.ts   # LLM routing (Gemini / OpenRouter) — SỬA Ở ĐÂY DUY NHẤT
│   │       ├── stt/
│   │       │   └── adapter.ts  # STT adapter interface — đổi provider chỉ sửa đây
│   │       ├── report/
│   │       │   ├── generator.ts
│   │       │   └── templates.ts
│   │       ├── chat/
│   │       │   └── engine.ts
│   │       ├── export/
│   │       │   └── index.ts
│   │       ├── db/
│   │       │   └── local.ts    # Local file store — Phase 5 (replaces Supabase)
│   │       ├── settings/
│   │       │   └── store.ts    # Read/write ~/.transcript-ai/settings.json
│   │       ├── routes/         # Hono route handlers
│   │       └── config.ts       # Env vars (process.env)
│   │
│   └── desktop/                # Electron native app (Phase 4)
│       ├── src/
│       │   └── main.ts         # Electron main process
│       ├── build/
│       │   └── entitlements.mac.plist  # macOS mic + screen permissions
│       ├── package.json
│       └── tsconfig.json
│
└── packages/
    └── shared/                 # Dùng chung giữa web + server + desktop
        └── src/
            ├── types/          # Tất cả TypeScript types
            ├── constants/      # Enums, magic strings
            └── utils/          # Pure functions không có side effects
```

---

## 4. Bảo mật — Luật không được phá

- **API keys (Gemini, STT) chỉ tồn tại ở backend (`apps/server`)** — đọc từ `~/.transcript-ai/settings.json` (ưu tiên) hoặc `.env` (fallback)
- Frontend chỉ giao tiếp với backend của mình qua REST/WebSocket
- **TUYỆT ĐỐI không nhúng bất kỳ API key nào vào `apps/web` hay `apps/desktop`**
- Kiểm tra: nếu một giá trị bắt đầu bằng `VITE_` → nó sẽ lộ ra client → không đặt key ở đây

---

## 5. LLM Routing — chỉ sửa `apps/server/src/llm/router.ts`

```typescript
// Luôn gọi qua interface này, không gọi thẳng SDK của provider
llm.complete({ prompt, tier: 'draft' | 'final', sensitive: boolean })
```

- `tier: 'final'` hoặc `sensitive: true` → model trả phí, no-training
- `tier: 'draft'` + `sensitive: false` → có thể dùng model free (nhưng KHÔNG được truyền transcript)
- **Mọi thứ liên quan đến transcript đều phải `sensitive: true`**

---

## 6. STT Adapter — chỉ sửa `apps/server/src/stt/adapter.ts`

```typescript
interface STTAdapter {
  transcribeFile(filePath: string): Promise<TranscriptSegment[]>
  streamTranscribe(audioStream: ReadableStream): AsyncIterable<PartialTranscript>
}
```

Đổi provider (AssemblyAI ↔ Deepgram ↔ Gladia) chỉ là đổi implementation của interface này. Code ở `ingestors/live.ts` và `ingestors/audio.ts` không cần thay đổi.

---

## 7. Quy ước đặt tên

- **Files:** `kebab-case.ts` (ví dụ: `report-generator.ts`)
- **Components React:** `PascalCase.tsx` (ví dụ: `TranscriptViewer.tsx`)
- **Functions/variables:** `camelCase`
- **Types/Interfaces:** `PascalCase` (ví dụ: `NormalizedContent`, `TranscriptSegment`)
- **Constants:** `SCREAMING_SNAKE_CASE` (ví dụ: `MAX_AUDIO_SIZE_MB`)
- **JSON file fields (local store):** `snake_case` (giữ nhất quán với cấu trúc cũ)

---

## 8. Commit convention

```
feat(phase1): add live recording WebSocket endpoint
fix(stt): handle empty segment from AssemblyAI
refactor(llm): extract router logic from report generator
```

Format: `<type>(<scope>): <mô tả ngắn>`
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## 9. Checklist trước khi mark task "done"

- [ ] TypeScript compile không lỗi (`tsc --noEmit`)
- [ ] ESLint không có warning/error
- [ ] Không có biến/import thừa
- [ ] Không có file/hàm trùng chức năng với code cũ
- [ ] Key không lộ ra phía client
- [ ] Đã cập nhật `ARCHITECTURE.md` nếu thêm module mới

---

## 10. Chi tiết theo module

- **Electron app, release, pitfalls** → [`apps/desktop/CLAUDE.md`](apps/desktop/CLAUDE.md)
- **Token & cost tracking, local storage, settings** → [`apps/server/CLAUDE.md`](apps/server/CLAUDE.md)
