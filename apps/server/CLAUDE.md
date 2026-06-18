# Server — apps/server/

> Đọc thêm root `CLAUDE.md` để biết coding laws, naming, security rules.

---

## Token & Cost Tracking

Mọi LLM call phải trả về `LLMUsage` và hiển thị trên UI.

```
llm.complete() → LLMResponse { text, model, usage? }
  ↓ extract usage
generator / engine / route → thêm LLMUsage vào response
  ↓
frontend → tích lũy trong ReportPage state → hiển thị card ở đầu sidebar
```

**Pricing (Gemini 2.5 Flash, no thinking):**
- Input: `$0.15 / 1_000_000` tokens — constant `PRICE_IN`
- Output: `$0.60 / 1_000_000` tokens — constant `PRICE_OUT`
- Defined inline trong `report/generator.ts`, `routes/report.ts`, `chat/engine.ts`

**Checklist khi thêm LLM call mới:**
1. `llm.complete()` → extract `result.usage` → build `LLMUsage` → return trong response
2. `api/client.ts`: thêm `llmUsage?: LLMUsage` vào response type
3. `ReportPage.tsx`: gọi `addUsage(result.llmUsage)` sau khi nhận response

**STT cost — KHÔNG hiển thị:** AssemblyAI ≈ $0.37/hr, Gemini STT ≈ $0.06/hr. Không có token count chính xác.

---

## Local Storage & Settings (Phase 5)

Tất cả dữ liệu lưu tại `~/.transcript-ai/`:
```
~/.transcript-ai/
├── settings.json          # AppSettings (API keys, STT provider, live recording defaults)
└── sessions/
    └── <uuid>.json        # SessionBundle (session + transcript + report + chat)
```

**`db/local.ts`** — thay thế Supabase:
```typescript
store.createSession / updateSession / deleteSession / getBundle / listSessions
store.createTranscript / getTranscript
store.createReport / getReport / getReportBySession
store.listSpeakers / upsertSpeaker
store.listMessages / createMessages
store.getTranslation / createTranslation
```

**`settings/store.ts`:**
```typescript
getSettings()           // đọc file, cache in-memory
updateSettings(patch)   // deep-merge patch, ghi file, clear cache
```

**API key resolution — lazy, tại thời điểm gọi:**
- `llm/router.ts`: `getGeminiKey()` → `getSettings().apiKeys.gemini` → fallback `config.geminiApiKey`
- `stt/adapter.ts`: proxy object `stt` gọi `getSettings()` mỗi lần
- Không cần restart server khi user thay đổi key qua Settings UI

**Settings API:**
```
GET  /api/settings   → AppSettings
PUT  /api/settings   → AppSettings (nhận partial patch, trả về full settings đã merge)
```

**AppSettings type** — định nghĩa trong `packages/shared/src/types/index.ts`:
```typescript
export interface AppSettings {
  apiKeys: { gemini: string; assemblyai: string; deepgram: string; gladia: string }
  sttProvider: 'assemblyai' | 'deepgram' | 'gemini' | 'gladia'
  liveRecording: {
    defaultSourceLang: string | null
    defaultTranslateLang: 'en' | 'fr' | 'vi' | null
  }
}
```
