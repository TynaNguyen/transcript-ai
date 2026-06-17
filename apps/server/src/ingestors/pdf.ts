/**
 * PDF Ingestor
 * Upload PDF → Gemini Files API → extract text content → NormalizedContent
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import { basename } from 'path'
import type { NormalizedContent } from '@transcript/shared'
import { config } from '../config.js'

const geminiClient = new GoogleGenerativeAI(config.geminiApiKey)
const fileManager = new GoogleAIFileManager(config.geminiApiKey)

/** Poll file state until ACTIVE or FAILED (max 60s) */
async function waitForFile(name: string): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const file = await fileManager.getFile(name)
    if (file.state === FileState.ACTIVE) return
    if (file.state === FileState.FAILED) throw new Error(`Gemini file processing failed: ${file.error?.message ?? 'unknown'}`)
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Gemini file processing timed out after 60s')
}

export async function ingestPdf(sessionId: string, filePath: string): Promise<NormalizedContent> {
  // 1. Upload to Gemini Files API
  const uploadRes = await fileManager.uploadFile(filePath, {
    mimeType: 'application/pdf',
    displayName: basename(filePath),
  })

  await waitForFile(uploadRes.file.name)

  // 2. Ask Gemini to extract text
  // Use gemini-2.0-flash (not 2.5-flash) — 2.5 is a thinking model, extremely slow on large PDFs
  // gemini-2.5-flash with thinking disabled — fast as 1.5-flash, no thinking tokens overhead
  const model = geminiClient.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object,
  })

  const GEMINI_TIMEOUT_MS = 3 * 60 * 1000 // 3 min — Gemini 2.5 Flash can be slow on large PDFs

  const result = await Promise.race([
    model.generateContent([
      {
        fileData: {
          mimeType: 'application/pdf',
          fileUri: uploadRes.file.uri,
        },
      },
      {
        text: `Extract the full text content from this PDF document.

Return a JSON object with this exact shape (no markdown fences):
{
  "title": "<document title or filename if not found>",
  "pageCount": <number of pages>,
  "text": "<full extracted text, preserving paragraph structure with newlines>"
}

Rules:
- Preserve headings, bullet points, and paragraph structure using newlines
- Include all readable text including headers, footers if they contain content
- Respond with ONLY the JSON, no explanation`,
      },
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF extraction timed out after 3 minutes')), GEMINI_TIMEOUT_MS),
    ),
  ])

  // Cleanup uploaded file (non-fatal)
  fileManager.deleteFile(uploadRes.file.name).catch(() => undefined)

  const raw = result.response.text().trim()

  let parsed: { title: string; pageCount: number; text: string }

  try {
    // Gemini sometimes wraps in ```json or adds text before/after — extract first {...} block
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')
    parsed = JSON.parse(jsonMatch[0]) as typeof parsed
  } catch {
    // Fallback: treat entire response as plain text
    parsed = { title: basename(filePath, '.pdf'), pageCount: 0, text: raw }
  }

  return {
    sessionId,
    kind: 'pdf',
    text: parsed.text,
    meta: {
      title: parsed.title || basename(filePath, '.pdf'),
    },
  }
}
