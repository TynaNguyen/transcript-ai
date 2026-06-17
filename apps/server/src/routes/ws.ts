/**
 * WebSocket handler — Live Recording
 *
 * Client → server messages:
 *   { type: 'audio_chunk', data: base64 }        — raw PCM Int16 @ 16kHz → realtime STT
 *   { type: 'audio_batch_chunk', data: base64 }  — WebM/Opus → ghi file → batch STT sau Stop
 *   { type: 'session_end' }
 *
 * Server → client messages:
 *   { type: 'partial_transcript', data: PartialTranscript | { sessionId } }
 *   { type: 'final_transcript', data: TranscriptSegment[] }
 *   { type: 'session_end', data: { reportId, sessionId } }
 *   { type: 'error', data: { message } }
 */

import type { WebSocket } from 'ws'
import type { WSMessage, PartialTranscript } from '@transcript/shared'
import {
  startLiveSession,
  appendBatchChunk,
  finalizeLiveSession,
} from '../ingestors/live.js'
import { generateReport } from '../report/generator.js'
import { stt } from '../stt/adapter.js'

function send(ws: WebSocket, msg: WSMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
}

export async function handleLiveSession(ws: WebSocket, languageCode?: string): Promise<void> {
  let session: Awaited<ReturnType<typeof startLiveSession>> | null = null
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

  // Collect isFinal realtime segments as fallback if batch STT fails
  const liveSegments: import('@transcript/shared').TranscriptSegment[] = []

  // Tạo session
  try {
    session = await startLiveSession()
    send(ws, {
      type: 'partial_transcript',
      sessionId: session.sessionId,
      data: { sessionId: session.sessionId, started: true },
    })
  } catch (err) {
    send(ws, { type: 'error', sessionId: 'unknown', data: { message: String(err) } })
    ws.close()
    return
  }

  // Realtime STT stream (nhận PCM chunks từ client)
  const audioStream = new ReadableStream<Uint8Array>({
    start(ctrl) { streamController = ctrl },
  })

  // Đóng stream an toàn — tránh ERR_INVALID_STATE khi close() gọi 2 lần
  function closeStream() {
    if (!streamController) return
    const ctrl = streamController
    streamController = null
    try { ctrl.close() } catch { /* already closed */ }
  }

  // Start streaming STT in background — collect final segments as fallback
  ;(async () => {
    try {
      for await (const partial of stt.streamTranscribe(audioStream, { languageCode })) {
        const typedPartial = partial as PartialTranscript
        send(ws, {
          type: 'partial_transcript',
          sessionId: session!.sessionId,
          data: typedPartial,
        })
        // Keep final segments server-side — used as fallback if batch STT fails
        if (typedPartial.isFinal && typedPartial.text?.trim()) {
          liveSegments.push({
            speaker: typedPartial.speaker ?? 'Speaker 1',
            text: typedPartial.text,
            start: typedPartial.start ?? 0,
            end: typedPartial.start ?? 0,
            confidence: 1,
          })
        }
      }
    } catch (err) {
      console.error('[WS] Realtime STT error:', err)
      // Non-fatal: vẫn có batch STT sau khi Stop
    }
  })()

  ws.on('message', async (raw) => {
    if (!session) return
    try {
      const msg = JSON.parse(String(raw)) as { type: string; data?: string }

      if (msg.type === 'audio_chunk' && msg.data) {
        // PCM Int16 → feed vào realtime STT
        const buf = Buffer.from(msg.data, 'base64')
        try { streamController?.enqueue(new Uint8Array(buf)) } catch { /* stream closed */ }
      }

      if (msg.type === 'audio_batch_chunk' && msg.data) {
        // WebM/Opus → lưu để batch STT sau
        const buf = Buffer.from(msg.data, 'base64')
        appendBatchChunk(session, new Uint8Array(buf))
      }

      if (msg.type === 'session_end') {
        closeStream()
        setImmediate(async () => {
          try {
            const content = await finalizeLiveSession(session!, liveSegments)
            send(ws, {
              type: 'final_transcript',
              sessionId: session!.sessionId,
              data: content.transcript ?? [],
            })
            const { reportId, llmUsage } = await generateReport(content, {
              sessionId: session!.sessionId,
              template: 'meeting-minutes',
            })
            const sttProvider = languageCode === 'en' ? 'assemblyai' : 'gemini'
            const audioDurationSec = content.meta.duration ?? 0
            // AssemblyAI Universal Streaming: ~$0.37/hr; Gemini audio: ~$0.06/hr (billed as tokens)
            const STT_COST_PER_SEC: Record<string, number> = {
              assemblyai: 0.37 / 3600,
              gemini: 0.06 / 3600,
            }
            const sttCostUsd = audioDurationSec * (STT_COST_PER_SEC[sttProvider] ?? 0)
            send(ws, {
              type: 'session_end',
              sessionId: session!.sessionId,
              data: {
                reportId,
                sessionId: session!.sessionId,
                cost: {
                  llm: llmUsage,
                  stt: { provider: sttProvider, audioDurationSec, costUsd: sttCostUsd },
                },
              },
            })
          } catch (err) {
            send(ws, {
              type: 'error',
              sessionId: session!.sessionId,
              data: { message: `Finalization failed: ${String(err)}` },
            })
          }
        })
      }
    } catch (err) {
      send(ws, {
        type: 'error',
        sessionId: session?.sessionId ?? 'unknown',
        data: { message: String(err) },
      })
    }
  })

  ws.on('close', closeStream)
  ws.on('error', closeStream)
}
