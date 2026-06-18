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

## 10. Token & Cost Tracking

Mọi LLM call đều phải trả về `LLMUsage` và hiển thị trên UI.

### Architecture
```
llm.complete() → LLMResponse { text, model, usage? }
  ↓ extract usage
generator / engine / route → thêm LLMUsage vào response
  ↓
frontend → tích lũy trong ReportPage state → hiển thị card ở đầu sidebar
```

### Pricing (Gemini 2.5 Flash, no thinking)
- Input: `$0.15 / 1_000_000` tokens — constant `PRICE_IN`
- Output: `$0.60 / 1_000_000` tokens — constant `PRICE_OUT`
- Defined inline trong `report/generator.ts`, `routes/report.ts`, `chat/engine.ts`

### Checklist khi thêm LLM call mới
1. **Server**: `llm.complete()` → extract `result.usage` → build `LLMUsage` → return trong response
2. **`api/client.ts`**: Thêm `llmUsage?: LLMUsage` vào response type
3. **`ReportPage.tsx`**: Gọi `addUsage(result.llmUsage)` sau khi nhận response

### Live Recording flow
WebSocket `session_end` → `useLiveRecording.sessionCost` → `navigate(state: { cost })` → `ReportPage` đọc `location.state`

### Ingest flow (PDF/video/etc.)
`finalizeIngest()` → `generateReport()` → `llmUsage` trong API response → `IngestPage` navigate với `state: { cost: { llm } }`

### Default UI (Live Recording)
- Transcript language và translate language đọc từ `settings.liveRecording.defaultSourceLang/defaultTranslateLang` (Phase 5)
- Fallback nếu settings null: `sourceLang = 'en'`, `translateLang = 'vi'`
- Cài đặt mặc định thay đổi được qua trang Settings, **không hardcode trong code**

### STT cost — KHÔNG hiển thị trên UI
AssemblyAI ≈ $0.37/hr, Gemini STT ≈ $0.06/hr. Không có token count chính xác nên không show.

---

## 11. Electron Desktop App (Phase 4)

### Tại sao Electron (không phải Pake/browser extension)
- **Pake** (tw93/pake) chỉ wrap remote URL qua Tauri — không thể bundle local backend server
- **Electron** cho phép chạy Node.js (Hono server) trong main process + BrowserWindow load `http://localhost:3001`
- Mic permissions đơn giản hơn nhiều so với browser: khai báo trong `entitlements.mac.plist` là xong

### Kiến trúc Electron

```
Electron Main Process (Node.js)
  ├── Spawn Hono server (apps/server) trực tiếp trong main process
  │     → ELECTRON_WEB_ROOT env var trỏ tới thư mục build của apps/web
  │     → Hono serve static files tại GET /* khi env đó được set
  └── BrowserWindow load http://localhost:3001
        → Không có CORS issue (cùng origin)
        → Không cần VITE_API_URL khác nhau giữa dev và prod
```

### Biến môi trường quan trọng
- `ELECTRON_WEB_ROOT` — đường dẫn tuyệt đối tới `apps/web/dist/` (chỉ set trong production Electron)
- Khi set → Hono tự serve React build, BrowserWindow load `http://localhost:3001`
- Khi không set → server chạy bình thường, React dev server (`localhost:5173`) chạy riêng

### Build pipeline
```
1. Build React:    cd apps/web && npm run build         → apps/web/dist/
2. Bundle server:  cd apps/server && npx ncc build src/index.ts -o dist/
3. Package app:    cd apps/desktop && npx electron-builder
```
- `@vercel/ncc` bundle server + all node_modules vào 1 file JS duy nhất
- `electron-builder` đóng gói: Electron runtime + bundled server + React dist + `.env`

### Cấu trúc apps/desktop/
```
apps/desktop/
├── src/main.ts             # Main process: set env vars, start server, open window
├── build/
│   └── entitlements.mac.plist  # NSMicrophoneUsageDescription, etc.
├── package.json            # electron, electron-builder deps
└── tsconfig.json           # target: ES2022, module: CommonJS (Electron yêu cầu)
```

### Dev vs Production
| | Dev | Production (Electron) |
|---|---|---|
| React | `localhost:5173` (Vite) | `localhost:3001` (Hono static) |
| Server | `ts-node`/`tsx` | `ncc` bundled JS |
| API keys | `.env` file | `.env` embedded in extraResources |
| CORS | `corsOrigin: localhost:5173` | không cần (same origin) |

### Quyền macOS (entitlements.mac.plist)
Khai báo trong `build/entitlements.mac.plist`:
- `com.apple.security.device.audio-input` — ghi âm microphone
- `com.apple.security.device.camera` — (tuỳ chọn) screen capture
- Electron-builder tự inject khi sign app

### Auto-update (Phase 5 — electron-updater)
App tự kiểm tra update khi mở, tải về nền, hỏi user khi sẵn sàng cài.

**Quy trình release — checklist đầy đủ:**
```bash
# 1. Bump version trong apps/desktop/package.json
#    "version": "1.1.0" → "1.2.0"

# 2. Commit + tag + push
git add apps/desktop/package.json
git commit -m "chore: bump version to 1.2.0"
git tag v1.2.0
git push && git push --tags
# → GitHub Actions tự build macOS/Windows/Linux rồi publish GitHub Release
```

**Nhắc user sau khi push tag:**
1. Theo dõi CI tại `https://github.com/TynaNguyen/transcript-ai/actions` — build mất ~10-15 phút (3 OS song song)
2. Khi xong → release tự publish tại `https://github.com/TynaNguyen/transcript-ai/releases`
3. **Auto-update không hoạt động trên macOS** (app chưa code sign) → bảo user tải DMG mới về cài đè thủ công:
   - Mac M1/M2/M3 → `Transcript-AI-x.x.x-arm64.dmg`
   - Mac Intel → `Transcript-AI-x.x.x.dmg`
   - Windows → `Transcript-AI-Setup-x.x.x.exe`
4. Nếu macOS báo **"app bị hỏng"** khi mở sau khi cài → chạy: `xattr -cr "/Applications/Transcript AI.app"`

**CI/CD:** `.github/workflows/release.yml` — trigger khi push tag `v*`.
Mỗi job chạy trên OS riêng (macOS/Windows/Linux), build toàn bộ stack, upload lên GitHub Releases.
`GH_TOKEN` = `secrets.GITHUB_TOKEN` tự động có trong GitHub Actions, không cần setup thêm.
`releaseType: "release"` đã set trong `package.json` → CI publish trực tiếp, không tạo draft.

**Flow update phía user (nếu app đã được code sign):**
1. App mở → `autoUpdater.checkForUpdatesAndNotify()` chạy ngầm
2. Nếu có version mới → tải về nền (không block UI)
3. Khi tải xong → dialog "Restart & Update" / "Later"
4. Chọn Restart → `autoUpdater.quitAndInstall()` cài và mở lại

**Lưu ý macOS:** Auto-update chỉ hoạt động với app đã được **code sign** (Apple Developer Program $99/năm). App unsigned sẽ bị Gatekeeper block khi cài update ngầm → user phải tải DMG thủ công.

**Pitfall — dev server conflict:** Khi test production app, phải tắt dev server (`npm run dev`) trước. Nếu dev server đang chạy trên port 3001, packaged Electron app sẽ dùng nhầm dev server (không có `ELECTRON_WEB_ROOT`) → app hiện 404. Kiểm tra tại `http://localhost:3001/debug-env` — nếu thấy `nodeEnv: "development"` thì đang bị conflict.

---

## 12. Local Storage & Settings (Phase 5)

### Mục tiêu
App chạy hoàn toàn offline, không cần Supabase. Người dùng tự cung cấp API key.

### Data directory
Tất cả dữ liệu lưu tại `~/.transcript-ai/`:
```
~/.transcript-ai/
├── settings.json          # AppSettings (API keys, STT provider, live recording defaults)
└── sessions/
    └── <uuid>.json        # SessionBundle (session + transcript + report + chat + translations)
```

### Local store — `apps/server/src/db/local.ts`
Thay thế hoàn toàn Supabase. Export object `store` với các methods:
```typescript
store.createSession / updateSession / deleteSession / getBundle / listSessions
store.createTranscript / getTranscript
store.createReport / getReport / getReportBySession
store.listSpeakers / upsertSpeaker
store.listMessages / createMessages
store.getTranslation / createTranslation
```
Mỗi session = 1 file JSON (`SessionBundle`). Không có DB, không có network call.

### Settings store — `apps/server/src/settings/store.ts`
```typescript
getSettings()           // đọc file, cache in-memory
updateSettings(patch)   // deep-merge patch vào settings hiện tại, ghi file, clear cache
invalidateSettingsCache()
```
`DEFAULT_SETTINGS` định nghĩa cấu trúc mặc định (tất cả key rỗng).

### API key resolution — lazy, tại thời điểm gọi
- `llm/router.ts`: `getGeminiKey()` → `getSettings().apiKeys.gemini` → fallback `config.geminiApiKey` → throw nếu trống
- `stt/adapter.ts`: factory functions nhận `apiKey` parameter; proxy object `stt` gọi `getSettings()` mỗi lần
- **Không cần restart server khi user thay đổi key qua Settings UI**

### Settings API
```
GET  /api/settings   → AppSettings
PUT  /api/settings   → AppSettings (nhận partial patch, trả về full settings đã merge)
```

### Frontend settings flow
- `App.tsx` fetch settings lúc mount → lưu vào `SettingsContext`
- `RequireSetup` component: nếu `settings.apiKeys.gemini` trống → redirect `/settings?setup=true`
- `SettingsPage.tsx` sau khi save thành công → gọi `setContextSettings(saved)` để update context ngay, rồi navigate
- `useAppSettings()` hook — dùng ở bất kỳ component nào cần đọc settings

### AppSettings type — `packages/shared/src/types/index.ts`
```typescript
export type SttProvider = 'assemblyai' | 'deepgram' | 'gemini' | 'gladia'
export interface AppSettings {
  apiKeys: { gemini: string; assemblyai: string; deepgram: string; gladia: string }
  sttProvider: SttProvider
  liveRecording: {
    defaultSourceLang: string | null
    defaultTranslateLang: 'en' | 'fr' | 'vi' | null
  }
}
```

### Onboarding flow
1. Lần đầu mở app → `settings.json` chưa có → `apiKeys.gemini` trống
2. `RequireSetup` redirect → `/settings?setup=true`
3. User nhập Gemini key → Save → `setContextSettings` update context → `navigate('/')`
4. Các lần sau: key đã có → vào thẳng app
