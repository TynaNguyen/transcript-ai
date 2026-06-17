/**
 * Local file-based store — replaces Supabase.
 * Each session is stored as a JSON bundle in ~/.transcript-ai/sessions/<id>.json
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  DbSession,
  DbTranscript,
  DbReport,
  DbSpeaker,
  DbChatMessage,
  ReportTemplate,
  SourceKind,
  Language,
  TranscriptSegment,
} from '@transcript/shared'
import { DATA_DIR } from '../settings/store.js'

const SESSIONS_DIR = join(DATA_DIR, 'sessions')

interface Translation {
  source_id: string
  source_type: string
  target_lang: string
  content: string
}

export interface SessionBundle {
  session: DbSession
  transcript: DbTranscript | null
  report: DbReport | null
  speakers: DbSpeaker[]
  chatMessages: DbChatMessage[]
  translations: Translation[]
}

async function ensureDirs(): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true })
}

async function readBundle(id: string): Promise<SessionBundle | null> {
  try {
    const raw = await readFile(join(SESSIONS_DIR, `${id}.json`), 'utf8')
    return JSON.parse(raw) as SessionBundle
  } catch {
    return null
  }
}

async function writeBundle(bundle: SessionBundle): Promise<void> {
  await ensureDirs()
  await writeFile(
    join(SESSIONS_DIR, `${bundle.session.id}.json`),
    JSON.stringify(bundle, null, 2),
    'utf8',
  )
}

async function allBundles(): Promise<SessionBundle[]> {
  await ensureDirs()
  const files = await readdir(SESSIONS_DIR)
  const results = await Promise.all(
    files.filter((f) => f.endsWith('.json')).map((f) => readBundle(f.slice(0, -5))),
  )
  return results.filter((b): b is SessionBundle => b !== null)
}

export const store = {
  // ── Sessions ──────────────────────────────────────────────────────────────

  async createSession(data: {
    type: SourceKind
    title: string
    status?: DbSession['status']
  }): Promise<DbSession> {
    await ensureDirs()
    const session: DbSession = {
      id: randomUUID(),
      type: data.type,
      title: data.title,
      status: data.status ?? 'processing',
      created_at: new Date().toISOString(),
    }
    await writeBundle({
      session,
      transcript: null,
      report: null,
      speakers: [],
      chatMessages: [],
      translations: [],
    })
    return session
  },

  async updateSession(id: string, data: Partial<DbSession>): Promise<void> {
    const bundle = await readBundle(id)
    if (!bundle) return
    bundle.session = { ...bundle.session, ...data }
    await writeBundle(bundle)
  },

  async deleteSession(id: string): Promise<void> {
    try {
      await unlink(join(SESSIONS_DIR, `${id}.json`))
    } catch { /* not found — ok */ }
  },

  async getBundle(id: string): Promise<SessionBundle | null> {
    return readBundle(id)
  },

  async listSessions(): Promise<
    Array<DbSession & { reports: Pick<DbReport, 'id' | 'template' | 'created_at'>[] }>
  > {
    const bundles = await allBundles()
    return bundles
      .map((b) => ({
        ...b.session,
        reports: b.report
          ? [{ id: b.report.id, template: b.report.template, created_at: b.report.created_at }]
          : [],
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 200)
  },

  // ── Transcripts ───────────────────────────────────────────────────────────

  async createTranscript(data: {
    session_id: string
    segments: TranscriptSegment[]
    raw_text: string
    language?: Language | null
  }): Promise<void> {
    const bundle = await readBundle(data.session_id)
    if (!bundle) throw new Error(`Session not found: ${data.session_id}`)
    bundle.transcript = {
      id: randomUUID(),
      session_id: data.session_id,
      segments: data.segments,
      raw_text: data.raw_text,
      ...(data.language ? { language: data.language } : {}),
    }
    await writeBundle(bundle)
  },

  async getTranscript(sessionId: string): Promise<DbTranscript | null> {
    const bundle = await readBundle(sessionId)
    return bundle?.transcript ?? null
  },

  // ── Reports ───────────────────────────────────────────────────────────────

  async createReport(data: {
    session_id: string
    template: ReportTemplate
    content_md: string
  }): Promise<DbReport> {
    const bundle = await readBundle(data.session_id)
    if (!bundle) throw new Error(`Session not found: ${data.session_id}`)
    const report: DbReport = {
      id: randomUUID(),
      session_id: data.session_id,
      template: data.template,
      content_md: data.content_md,
      created_at: new Date().toISOString(),
    }
    bundle.report = report
    await writeBundle(bundle)
    return report
  },

  async getReport(id: string): Promise<(DbReport & { session_title?: string }) | null> {
    const bundles = await allBundles()
    for (const b of bundles) {
      if (b.report?.id === id) return { ...b.report, session_title: b.session.title }
    }
    return null
  },

  async getReportBySession(sessionId: string): Promise<DbReport | null> {
    const bundle = await readBundle(sessionId)
    return bundle?.report ?? null
  },

  // ── Speakers ──────────────────────────────────────────────────────────────

  async listSpeakers(sessionId: string): Promise<DbSpeaker[]> {
    const bundle = await readBundle(sessionId)
    return bundle?.speakers ?? []
  },

  async upsertSpeaker(data: {
    session_id: string
    label: string
    display_name: string
  }): Promise<void> {
    const bundle = await readBundle(data.session_id)
    if (!bundle) return
    const idx = bundle.speakers.findIndex(
      (s) => s.label === data.label && s.session_id === data.session_id,
    )
    if (idx >= 0) {
      bundle.speakers[idx] = { ...bundle.speakers[idx]!, display_name: data.display_name }
    } else {
      bundle.speakers.push({
        id: randomUUID(),
        session_id: data.session_id,
        label: data.label,
        display_name: data.display_name,
      })
    }
    await writeBundle(bundle)
  },

  // ── Chat messages ─────────────────────────────────────────────────────────

  async listMessages(sessionId: string): Promise<DbChatMessage[]> {
    const bundle = await readBundle(sessionId)
    return bundle?.chatMessages ?? []
  },

  async createMessages(
    items: { session_id: string; role: 'user' | 'assistant'; content: string }[],
  ): Promise<DbChatMessage[]> {
    if (items.length === 0) return []
    const sessionId = items[0]!.session_id
    const bundle = await readBundle(sessionId)
    if (!bundle) throw new Error(`Session not found: ${sessionId}`)
    const created: DbChatMessage[] = items.map((d) => ({
      id: randomUUID(),
      session_id: d.session_id,
      role: d.role,
      content: d.content,
      created_at: new Date().toISOString(),
    }))
    bundle.chatMessages.push(...created)
    await writeBundle(bundle)
    return created
  },

  // ── Translations ──────────────────────────────────────────────────────────

  async getTranslation(
    sourceId: string,
    sourceType: string,
    targetLang: string,
  ): Promise<string | null> {
    const bundles = await allBundles()
    for (const b of bundles) {
      const match = b.translations.find(
        (x) =>
          x.source_id === sourceId &&
          x.source_type === sourceType &&
          x.target_lang === targetLang,
      )
      if (match) return match.content
    }
    return null
  },

  async createTranslation(data: {
    source_id: string
    source_type: string
    target_lang: string
    content: string
  }): Promise<void> {
    const bundles = await allBundles()
    for (const b of bundles) {
      if (b.report?.id === data.source_id || b.session.id === data.source_id) {
        b.translations.push(data)
        await writeBundle(b)
        return
      }
    }
  },
}
