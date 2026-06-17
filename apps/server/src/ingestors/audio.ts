/**
 * Audio File Ingestor
 * Upload file → AssemblyAI batch STT (có diarization) → NormalizedContent
 * Dùng stt.transcribeFile() — cùng path với live batch ở finalizeLiveSession
 */

import { basename } from 'path'
import type { NormalizedContent } from '@transcript/shared'
import { stt } from '../stt/adapter.js'

export async function ingestAudio(sessionId: string, filePath: string): Promise<NormalizedContent> {
  const segments = await stt.transcribeFile(filePath)

  const lastSegment = segments[segments.length - 1]
  const duration = lastSegment !== undefined ? lastSegment.end : 0

  return {
    sessionId,
    kind: 'audio',
    transcript: segments,
    meta: {
      title: basename(filePath),
      duration,
    },
  }
}
