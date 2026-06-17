/**
 * POST /api/ingest/:type
 *
 * Flow:
 *   1. Create session (status: processing)
 *   2. Call ingestor → NormalizedContent
 *   3. Save transcript
 *   4. Generate report
 *   5. Update session status → ready
 *   6. Return { sessionId, reportId }
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { NormalizedContent, SourceKind } from '@transcript/shared'
import { store } from '../db/local.js'
import { generateReport } from '../report/generator.js'
import { ingestYoutube } from '../ingestors/youtube.js'
import { ingestPdf } from '../ingestors/pdf.js'
import { ingestWeb } from '../ingestors/web.js'
import { ingestVideo } from '../ingestors/video.js'
import { ingestAudio } from '../ingestors/audio.js'

export const ingestRoutes = new Hono()

const TMP_DIR = '/tmp/transcript-uploads'

async function createSession(type: SourceKind, title: string): Promise<string> {
  const session = await store.createSession({ type, title, status: 'processing' })
  return session.id
}

async function saveTranscript(content: NormalizedContent): Promise<void> {
  const rawText = content.transcript
    ? content.transcript.map((s) => `${s.speaker}: ${s.text}`).join('\n')
    : (content.text ?? '')

  await store.createTranscript({
    session_id: content.sessionId,
    segments: content.transcript ?? [],
    raw_text: rawText,
    language: content.meta.language ?? null,
  })
}

async function saveUploadedFile(file: File): Promise<string> {
  await mkdir(TMP_DIR, { recursive: true })
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const tmpPath = join(TMP_DIR, `${randomUUID()}${ext}`)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(tmpPath, buffer)
  return tmpPath
}

async function finalizeIngest(
  content: NormalizedContent,
  template: 'meeting-minutes' | 'content-report',
): Promise<{ sessionId: string; reportId: string; llmUsage: import('@transcript/shared').LLMUsage }> {
  await saveTranscript(content)
  const { reportId, llmUsage } = await generateReport(content, { sessionId: content.sessionId, template })
  await store.updateSession(content.sessionId, { status: 'ready' })
  return { sessionId: content.sessionId, reportId, llmUsage }
}

// ── YouTube ────────────────────────────────────────────────────────────────────

ingestRoutes.post(
  '/youtube',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    const sessionId = await createSession('youtube', url)
    try {
      const content = await ingestYoutube(sessionId, url)
      return c.json({ success: true, data: await finalizeIngest(content, 'content-report') })
    } catch (err) {
      await store.updateSession(sessionId, { status: 'error' })
      return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500)
    }
  },
)

// ── PDF ────────────────────────────────────────────────────────────────────────

ingestRoutes.post('/pdf', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return c.json({ success: false, error: 'Missing file field' }, 400)

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext !== 'pdf' && file.type !== 'application/pdf') {
    return c.json({ success: false, error: `Expected a PDF file, got ".${ext}". Please upload a .pdf file.` }, 400)
  }

  const sessionId = await createSession('pdf', file.name)
  let tmpPath: string | null = null
  try {
    tmpPath = await saveUploadedFile(file)
    const content = await ingestPdf(sessionId, tmpPath)
    return c.json({ success: true, data: await finalizeIngest(content, 'content-report') })
  } catch (err) {
    await store.updateSession(sessionId, { status: 'error' })
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500)
  } finally {
    if (tmpPath) unlink(tmpPath).catch(() => undefined)
  }
})

// ── Web URL ────────────────────────────────────────────────────────────────────

ingestRoutes.post(
  '/web',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    const sessionId = await createSession('web', url)
    try {
      const content = await ingestWeb(sessionId, url)
      if (content.meta.title) await store.updateSession(sessionId, { title: content.meta.title })
      return c.json({ success: true, data: await finalizeIngest(content, 'content-report') })
    } catch (err) {
      await store.updateSession(sessionId, { status: 'error' })
      return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500)
    }
  },
)

// ── Video file ─────────────────────────────────────────────────────────────────

ingestRoutes.post('/video', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return c.json({ success: false, error: 'Missing file field' }, 400)

  const sessionId = await createSession('video', file.name)
  let tmpPath: string | null = null
  try {
    tmpPath = await saveUploadedFile(file)
    const content = await ingestVideo(sessionId, tmpPath)
    return c.json({ success: true, data: await finalizeIngest(content, 'meeting-minutes') })
  } catch (err) {
    await store.updateSession(sessionId, { status: 'error' })
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500)
  } finally {
    if (tmpPath) unlink(tmpPath).catch(() => undefined)
  }
})

// ── Audio file ─────────────────────────────────────────────────────────────────

ingestRoutes.post('/audio', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return c.json({ success: false, error: 'Missing file field' }, 400)

  const sessionId = await createSession('audio', file.name)
  let tmpPath: string | null = null
  try {
    tmpPath = await saveUploadedFile(file)
    const content = await ingestAudio(sessionId, tmpPath)
    return c.json({ success: true, data: await finalizeIngest(content, 'meeting-minutes') })
  } catch (err) {
    await store.updateSession(sessionId, { status: 'error' })
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500)
  } finally {
    if (tmpPath) unlink(tmpPath).catch(() => undefined)
  }
})
