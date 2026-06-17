import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { NormalizedContent, TranscriptSegment } from '@transcript/shared'
import { stt } from '../stt/adapter.js'
import { store } from '../db/local.js'

const TMP_DIR = '/tmp/transcript-audio'

export interface LiveSession {
  sessionId: string
  batchChunks: Uint8Array[]
  startedAt: number
}

export async function startLiveSession(title = 'Live Recording'): Promise<LiveSession> {
  const session = await store.createSession({ type: 'live', title, status: 'processing' })
  await mkdir(TMP_DIR, { recursive: true })
  return { sessionId: session.id, batchChunks: [], startedAt: Date.now() }
}

export function appendBatchChunk(session: LiveSession, chunk: Uint8Array): void {
  session.batchChunks.push(chunk)
}

export async function finalizeLiveSession(
  session: LiveSession,
  liveSegmentsFallback: TranscriptSegment[] = [],
): Promise<NormalizedContent> {
  const duration = (Date.now() - session.startedAt) / 1000
  let segments: TranscriptSegment[] = []

  if (session.batchChunks.length > 0) {
    const filePath = join(TMP_DIR, `${session.sessionId}.webm`)
    await writeFile(filePath, mergeUint8Arrays(session.batchChunks))

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Batch STT timeout after 3 minutes')), 3 * 60 * 1000),
      )
      segments = await Promise.race([stt.transcribeFile(filePath), timeout])
    } catch (err) {
      console.error('Batch STT failed:', err)
    }
  }

  if (segments.length === 0 && liveSegmentsFallback.length > 0) {
    console.warn('[live] Batch STT empty — using realtime fallback segments:', liveSegmentsFallback.length)
    segments = liveSegmentsFallback
  }

  const rawText = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n')
  await store.createTranscript({ session_id: session.sessionId, segments, raw_text: rawText })
  await store.updateSession(session.sessionId, { status: 'ready' })

  return {
    sessionId: session.sessionId,
    kind: 'live',
    transcript: segments,
    meta: { title: 'Live Recording', duration },
  }
}

function mergeUint8Arrays(arrays: Uint8Array[]): Buffer {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const merged = Buffer.alloc(total)
  let offset = 0
  for (const arr of arrays) { merged.set(arr, offset); offset += arr.length }
  return merged
}
