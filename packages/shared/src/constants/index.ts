// ============================================================
// Constants dùng chung — import từ @transcript/shared
// ============================================================

import type { Language, SourceKind, ExportFormat } from '../types/index.js'

// ------- Giới hạn upload -------
export const MAX_AUDIO_SIZE_MB = 500
export const MAX_VIDEO_SIZE_MB = 1000
export const MAX_PDF_SIZE_MB = 50

// ------- STT -------
export const STT_CHUNK_SIZE_MS = 250        // chunk audio mỗi 250ms
export const STT_SAMPLE_RATE = 16000        // Hz, chuẩn cho hầu hết STT providers
export const STT_MAX_SPEAKERS = 10

// ------- LLM -------
export const LLM_MAX_CONTEXT_TOKENS = 900_000   // Gemini Flash 1M context, để margin
export const LLM_RATE_LIMIT_RETRY_MS = 2000     // chờ 2s khi 429

// ------- Report -------
export const REPORT_MIN_LENGTH_WORDS = 300      // báo cáo phải có ít nhất 300 từ

// ------- Supported values -------
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'fr', 'vi']
export const SOURCE_KINDS: SourceKind[] = ['youtube', 'pdf', 'web', 'video', 'audio', 'live']
export const EXPORT_FORMATS: ExportFormat[] = ['md', 'docx', 'pdf']

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  vi: 'Tiếng Việt',
  auto: 'Auto-detect',
}

// ------- Session defaults -------
export const DEFAULT_SESSION_TITLE = 'Untitled Session'
export const SESSION_POLL_INTERVAL_MS = 1500

// ------- WebSocket -------
export const WS_HEARTBEAT_INTERVAL_MS = 30_000
export const WS_RECONNECT_DELAY_MS = 3_000
export const WS_MAX_RECONNECT_ATTEMPTS = 5
