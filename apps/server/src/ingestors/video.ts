/**
 * Video File Ingestor
 * Upload video → Gemini Files API (native video understanding) → transcript + meta
 * Gemini handles mp4/mov/avi/mkv/webm natively — no separate audio extraction needed
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import { basename, extname } from 'path'
import type { NormalizedContent } from '@transcript/shared'
import { config } from '../config.js'

const geminiClient = new GoogleGenerativeAI(config.geminiApiKey)
const fileManager = new GoogleAIFileManager(config.geminiApiKey)

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/avi',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
}

async function waitForFile(name: string): Promise<void> {
  const deadline = Date.now() + 5 * 60_000 // 5 min for large videos
  while (Date.now() < deadline) {
    const file = await fileManager.getFile(name)
    if (file.state === FileState.ACTIVE) return
    if (file.state === FileState.FAILED) throw new Error(`Gemini file processing failed: ${file.error?.message ?? 'unknown'}`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('Gemini file processing timed out after 5 minutes')
}

export async function ingestVideo(sessionId: string, filePath: string): Promise<NormalizedContent> {
  const ext = extname(filePath).toLowerCase()
  const mimeType = MIME_MAP[ext] ?? 'video/mp4'

  // 1. Upload to Gemini Files API
  const uploadRes = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: basename(filePath),
  })

  await waitForFile(uploadRes.file.name)

  // 2. Extract transcript via Gemini — use 2.0-flash, not 2.5 (thinking model, too slow for extraction)
  // gemini-2.5-flash with thinking disabled — fast extraction, no thinking tokens overhead
  const model = geminiClient.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object,
  })

  const result = await model.generateContent([
    {
      fileData: {
        mimeType,
        fileUri: uploadRes.file.uri,
      },
    },
    {
      text: `Extract the full transcript and metadata from this video file.

Return a JSON object with this exact shape (no markdown fences):
{
  "title": "<inferred title from content, or filename if unclear>",
  "duration": <total duration in seconds, integer>,
  "language": "<detected language code: en | vi | fr | other>",
  "transcript": [
    { "start": <seconds float>, "end": <seconds float>, "speaker": "<Speaker 1|2|...>", "text": "<spoken text>" }
  ]
}

Rules:
- Use distinct Speaker labels for each visible/audible speaker
- Group by natural sentence boundaries, not word-by-word
- If no speech, set "transcript": []
- Respond with ONLY the JSON`,
    },
  ])

  // Cleanup (non-fatal)
  fileManager.deleteFile(uploadRes.file.name).catch(() => undefined)

  const raw = result.response.text().trim()

  let parsed: {
    title: string
    duration: number
    language: string
    transcript: Array<{ start: number; end: number; speaker: string; text: string }>
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')
    parsed = JSON.parse(jsonMatch[0]) as typeof parsed
  } catch {
    throw new Error(`Video ingestor: Gemini returned invalid JSON. Raw: ${raw.slice(0, 200)}`)
  }

  return {
    sessionId,
    kind: 'video',
    transcript: parsed.transcript.map((s) => ({
      start: s.start,
      end: s.end,
      speaker: s.speaker ?? 'Speaker 1',
      text: s.text,
    })),
    meta: {
      title: parsed.title || basename(filePath),
      duration: parsed.duration,
      detectedLanguage: parsed.language,
    },
  }
}
