// ============================================================
// NGUỒN CHÍNH: Tất cả types dùng chung giữa web, server, extension
// KHÔNG định nghĩa lại ở nơi khác — luôn import từ @transcript/shared
// ============================================================

// ------- Source types -------

export type SourceKind = 'youtube' | 'pdf' | 'web' | 'video' | 'audio' | 'live'

export type SessionStatus = 'pending' | 'processing' | 'ready' | 'error'

export type Language = 'en' | 'fr' | 'vi' | 'auto'

// ------- Core pipeline type -------

/**
 * Output chung của MỌI ingestor.
 * Ingestor nhận input khác nhau → đều trả về kiểu này.
 */
export interface NormalizedContent {
  sessionId: string
  kind: SourceKind
  /** Text thuần (cho web/pdf khi không có transcript) */
  text?: string
  /** Transcript có timestamp + speaker (cho audio/video/live) */
  transcript?: TranscriptSegment[]
  /** Metadata nguồn gốc */
  meta: {
    title?: string
    url?: string
    duration?: number // giây
    language?: Language
    detectedLanguage?: string
  }
}

// ------- Transcript -------

export interface TranscriptSegment {
  start: number // giây
  end: number   // giây
  speaker: string // "Speaker 1", "Speaker 2", hoặc display name nếu đã đổi
  text: string
  confidence?: number
}

export interface PartialTranscript {
  /** Chunk real-time chưa hoàn chỉnh */
  text: string
  isFinal: boolean
  speaker?: string
  start?: number
}

// ------- Database row types (khớp với Supabase schema) -------

export interface DbSession {
  id: string
  type: SourceKind
  title: string
  status: SessionStatus
  created_at: string
  language_detected?: string
}

export interface DbSource {
  id: string
  session_id: string
  kind: SourceKind
  url?: string
  file_path?: string
  meta: Record<string, unknown>
}

export interface DbTranscript {
  id: string
  session_id: string
  segments: TranscriptSegment[]
  raw_text: string
  language?: Language
}

export interface DbReport {
  id: string
  session_id: string
  template: ReportTemplate
  content_md: string
  created_at: string
}

export interface DbChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface DbSpeaker {
  id: string
  session_id: string
  label: string        // "Speaker 1" (từ STT)
  display_name: string // "Anh Nam" (user đặt)
}

export interface DbTranslation {
  id: string
  source_id: string   // report id hoặc transcript id
  source_type: 'report' | 'transcript'
  target_lang: Language
  content: string
  created_at: string
}

// ------- Report -------

export type ReportTemplate = 'meeting-minutes' | 'content-report'

export interface ReportRequest {
  sessionId: string
  template: ReportTemplate
  language?: Language
}

// ------- Cost / Usage tracking -------

export interface LLMUsage {
  model: string
  inputTokens: number
  outputTokens: number
  /** Estimated cost in USD */
  costUsd: number
}

export interface STTUsage {
  provider: string
  audioDurationSec: number
  costUsd: number
}

export interface SessionCostSummary {
  llm: LLMUsage
  stt: STTUsage
}

// ------- LLM Router -------

export type LLMTier = 'draft' | 'final'

export interface LLMRequest {
  prompt: string
  tier: LLMTier
  /** true = chứa transcript/nội dung nhạy cảm → bắt buộc dùng paid model, no-training */
  sensitive: boolean
  systemPrompt?: string
  stream?: boolean
}

// ------- STT Adapter -------

export interface STTConfig {
  provider: 'assemblyai' | 'deepgram' | 'gladia'
  language: Language
  diarization: boolean
}

// ------- WebSocket messages -------

export type WSMessageType =
  | 'audio_chunk'      // client → server
  | 'partial_transcript' // server → client
  | 'final_transcript'  // server → client (sau batch)
  | 'error'
  | 'session_end'

export interface WSMessage {
  type: WSMessageType
  sessionId: string
  data: unknown
}

// ------- API response types -------

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface IngestResponse {
  sessionId: string
  status: SessionStatus
}

export interface ReportResponse {
  reportId: string
  contentMd: string
}

export interface TranslateResponse {
  translationId: string
  contentMd: string
  targetLang: Language
}

// ------- Export -------

export type ExportFormat = 'md' | 'docx' | 'pdf'

// ------- App Settings (stored in ~/.transcript-ai/settings.json) -------

export type SttProvider = 'assemblyai' | 'deepgram' | 'gemini' | 'gladia'

export interface AppSettings {
  apiKeys: {
    gemini: string
    assemblyai: string
    deepgram: string
    gladia: string
  }
  sttProvider: SttProvider
  liveRecording: {
    /** Language code for STT input, null = auto-detect */
    defaultSourceLang: string | null
    /** Language code to translate to, null = off */
    defaultTranslateLang: 'en' | 'fr' | 'vi' | null
  }
}
