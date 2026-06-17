/**
 * API client — chỉ gọi backend của mình
 * KHÔNG gọi Gemini/STT/Supabase trực tiếp từ frontend
 */

import { config } from '../config.js'
import type { ApiResponse, LLMUsage, AppSettings } from '@transcript/shared'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  const json = (await res.json()) as ApiResponse<T>

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`)
  }

  return json.data as T
}

/** Multipart form upload — không set Content-Type (browser tự thêm boundary) */
async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    body: formData,
  })

  // Guard against non-JSON responses (e.g. 404 HTML page if server not running)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Server error ${res.status} — is the backend running?`)
  }

  const json = (await res.json()) as ApiResponse<T>

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`)
  }

  return json.data as T
}

export interface IngestResult {
  sessionId: string
  reportId: string
  llmUsage?: LLMUsage
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChatResult {
  answer: string
  messageId: string
  llmUsage?: LLMUsage
}

export const api = {
  settings: {
    get: () => apiFetch<AppSettings>('/api/settings'),
    update: (patch: Partial<AppSettings>) =>
      apiFetch<AppSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
  },
  sessions: {
    list: () => apiFetch<unknown[]>('/api/sessions'),
    get: (id: string) => apiFetch<{ session: { type: string; title: string } }>(`/api/sessions/${id}`),
    delete: (id: string) => apiFetch<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
    renameSpeaker: (sessionId: string, label: string, displayName: string) =>
      apiFetch<void>(`/api/sessions/${sessionId}/speakers`, {
        method: 'PATCH',
        body: JSON.stringify({ label, displayName }),
      }),
    audioUrl: (id: string) => `${config.apiUrl}/api/sessions/${id}/audio`,
    rename: (id: string, title: string) =>
      apiFetch<void>(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
    bulkDelete: (ids: string[]) =>
      Promise.all(ids.map((id) => apiFetch<void>(`/api/sessions/${id}`, { method: 'DELETE' }))),
  },
  report: {
    get: (id: string) => apiFetch<{ content_md: string }>(`/api/report/${id}`),
    translate: (id: string, targetLang: 'en' | 'fr' | 'vi') =>
      apiFetch<{ content: string; cached: boolean; llmUsage?: LLMUsage }>(`/api/report/${id}/translate`, {
        method: 'POST',
        body: JSON.stringify({ targetLang }),
      }),
    exportDocxUrl: (id: string) => `${config.apiUrl}/api/report/${id}/export/docx`,
  },
  translate: {
    segment: (text: string, targetLang: 'en' | 'fr' | 'vi') =>
      apiFetch<{ translation: string }>('/api/translate/segment', {
        method: 'POST',
        body: JSON.stringify({ text, targetLang }),
      }),
  },
  ingest: {
    youtube: (url: string) =>
      apiFetch<IngestResult>('/api/ingest/youtube', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
    web: (url: string) =>
      apiFetch<IngestResult>('/api/ingest/web', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
    pdf: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiUpload<IngestResult>('/api/ingest/pdf', fd)
    },
    video: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiUpload<IngestResult>('/api/ingest/video', fd)
    },
    audio: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiUpload<IngestResult>('/api/ingest/audio', fd)
    },
  },
  chat: {
    history: (sessionId: string) =>
      apiFetch<ChatMessage[]>(`/api/chat/${sessionId}`),
    send: (sessionId: string, message: string) =>
      apiFetch<ChatResult>(`/api/chat/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
  },
}
