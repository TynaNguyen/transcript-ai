/**
 * STT Adapter — DUY NHẤT nơi tích hợp STT provider
 *
 * Đổi provider chỉ cần đổi STT_PROVIDER trong .env.
 * Code ở ingestors/ KHÔNG thay đổi.
 */

import { AssemblyAI } from 'assemblyai'
import type { TurnEvent } from 'assemblyai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import type { TranscriptSegment, PartialTranscript } from '@transcript/shared'
import { STT_SAMPLE_RATE } from '@transcript/shared'
import { config } from '../config.js'
import { getSettings } from '../settings/store.js'

export interface STTAdapter {
  transcribeFile(filePath: string): Promise<TranscriptSegment[]>
  streamTranscribe(
    audioStream: ReadableStream<Uint8Array>,
    options?: { languageCode?: string },
  ): AsyncIterable<PartialTranscript>
}

// ── AssemblyAI ─────────────────────────────────────────────────────────────────

function createAssemblyAIAdapter(apiKey: string): STTAdapter {
  const client = new AssemblyAI({ apiKey })

  return {
    async transcribeFile(filePath: string): Promise<TranscriptSegment[]> {
      const transcript = await client.transcripts.transcribe({
        audio: filePath,
        speaker_labels: true,
        language_detection: true,
      })

      if (transcript.status === 'error') {
        throw new Error(`AssemblyAI error: ${transcript.error ?? 'unknown'}`)
      }

      if (!transcript.utterances?.length) {
        return (transcript.words ?? []).map((w) => ({
          start: (w.start ?? 0) / 1000,
          end: (w.end ?? 0) / 1000,
          speaker: w.speaker ?? 'Speaker 1',
          text: w.text ?? '',
          confidence: w.confidence ?? undefined,
        }))
      }

      return transcript.utterances.map((u) => ({
        start: u.start / 1000,
        end: u.end / 1000,
        speaker: `Speaker ${u.speaker}`,
        text: u.words.map((w) => w.text).join(' '),
        confidence: u.confidence,
      }))
    },

    async *streamTranscribe(
      audioStream: ReadableStream<Uint8Array>,
      options?: { languageCode?: string },
    ): AsyncIterable<PartialTranscript> {
      // AssemblyAI v3 Streaming API (wss://streaming.assemblyai.com/v3/ws)
      // v2 realtime API is deprecated and returns 404
      //
      // universal-streaming-multilingual REQUIRES languageDetection: true and does NOT accept
      // language_code. Passing language_code: 'vi' causes silent failures (zero transcripts)
      // because it conflicts with or overrides the multilingual model selection.
      // Vietnamese is routed to Gemini by the factory — this path handles all other languages.
      const langOpts = { languageDetection: true }

      console.warn('[STT] streamTranscribe lang:', options?.languageCode ?? 'auto-detect')

      const transcriber = client.streaming.transcriber({
        sampleRate: STT_SAMPLE_RATE,
        encoding: 'pcm_s16le',
        speakerLabels: true,
        // universal-streaming-multilingual supports 99 languages including Vietnamese.
        // Default model is English-only — without this, auto-detect fails for non-English.
        speechModel: 'universal-streaming-multilingual' as string,
        ...langOpts,
        includePartialTurns: true,
        // Aggressive turn splitting for low-latency display:
        // 100ms silence → end turn (default 600ms, previously 300ms)
        minTurnSilence: 100,
        // End turn earlier when model is 40% confident (was 0.6)
        endOfTurnConfidenceThreshold: 0.4,
      })

      const queue: PartialTranscript[] = []
      let done = false
      // Event-driven signalling — wake yield loop immediately when event arrives
      let wakeUp: (() => void) | null = null
      const signal = () => { wakeUp?.(); wakeUp = null }

      transcriber.on('open', (session) => {
        console.warn('[STT] AssemblyAI streaming connected, session id:', session.id)
      })

      // TurnEvent: end_of_turn = true when sentence is complete
      transcriber.on('turn', (msg: TurnEvent) => {
        if (!msg.transcript) return
        const isFinal = msg.end_of_turn
        const rawSpeaker = msg.speaker_label ?? msg.words[0]?.speaker
        const speaker = rawSpeaker && rawSpeaker !== 'PENDING'
          ? `Speaker ${rawSpeaker}`
          : undefined
        const start = msg.words[0]?.start
        queue.push({
          text: msg.transcript,
          isFinal,
          ...(speaker !== undefined && { speaker }),
          ...(start != null && { start: start / 1000 }),
        })
        signal() // wake yield loop immediately — no 50ms polling delay
      })

      transcriber.on('error', (err: Error) => {
        console.error('[STT] streaming error:', err)
        done = true
        signal()
      })

      transcriber.on('close', (code: number, reason: string) => {
        console.warn('[STT] streaming closed:', code, reason)
        done = true
        signal()
      })

      console.warn('[STT] Connecting to AssemblyAI streaming...')
      try {
        const session = await transcriber.connect()
        console.warn('[STT] Connect resolved, session id:', session.id)
      } catch (connectErr) {
        console.error('[STT] connect() failed:', connectErr)
        done = true
        return
      }

      // Pipe PCM Int16 audio chunks vào transcriber
      // AssemblyAI streaming yêu cầu mỗi chunk >= 50ms và <= 1000ms
      // Tại 16kHz, 1 sample = 2 bytes (Int16), 50ms = 800 samples = 1600 bytes
      const MIN_CHUNK_BYTES = STT_SAMPLE_RATE * 2 * 0.050  // 50ms at 16kHz = 1600 bytes
      const reader = audioStream.getReader()
      ;(async () => {
        let pending = new Uint8Array(0)
        try {
          while (true) {
            const { done: streamDone, value } = await reader.read()
            if (streamDone || done) {
              // Flush còn lại nếu đủ dài
              if (pending.length >= MIN_CHUNK_BYTES) {
                try { transcriber.sendAudio(pending.buffer.slice(pending.byteOffset, pending.byteOffset + pending.byteLength)) } catch { /* ignore */ }
              }
              break
            }

            // Ghép vào buffer tích lũy
            const merged = new Uint8Array(pending.length + value.length)
            merged.set(pending)
            merged.set(value, pending.length)
            pending = merged

            // Gửi khi đủ >= 50ms
            if (pending.length >= MIN_CHUNK_BYTES) {
              try {
                transcriber.sendAudio(pending.buffer.slice(pending.byteOffset, pending.byteOffset + pending.byteLength))
                pending = new Uint8Array(0)
              } catch (e) {
                if (done) break
                console.error('[STT] sendAudio error:', e)
              }
            }
          }
        } finally {
          try { await transcriber.close() } catch { /* ignore — already closed */ }
        }
      })().catch((err) => console.error('[STT] pipe loop error:', err))

      // Yield transcript events — event-driven, no polling delay
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!
        } else if (!done) {
          await new Promise<void>((resolve) => { wakeUp = resolve })
        }
      }
    },
  }
}

// ── Deepgram ───────────────────────────────────────────────────────────────────

function createDeepgramAdapter(apiKey: string): STTAdapter {
  return {
    async transcribeFile(filePath: string): Promise<TranscriptSegment[]> {
      const { createClient } = await import('@deepgram/sdk')
      const deepgram = createClient(apiKey)

      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('fs').readFileSync(filePath),
        {
          model: 'nova-3',
          diarize: true,
          detect_language: true,
          punctuate: true,
          utterances: true,
        },
      )

      if (error) throw error

      const utterances = result?.results?.utterances ?? []
      return utterances.map((u) => ({
        start: u.start,
        end: u.end,
        speaker: `Speaker ${(u.speaker ?? 0) + 1}`,
        text: u.transcript,
        confidence: u.confidence,
      }))
    },

    async *streamTranscribe(_audioStream: ReadableStream<Uint8Array>, _options?: { languageCode?: string }): AsyncIterable<PartialTranscript> {
      // TODO: implement Deepgram live streaming
      throw new Error('Deepgram streaming not yet implemented')
    },
  }
}

// ── Gemini STT ─────────────────────────────────────────────────────────────────

/** Build a minimal WAV header for PCM Int16 mono audio */
function buildWavBuffer(pcmData: Uint8Array, sampleRate: number): Buffer {
  const dataSize = pcmData.length
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)       // PCM chunk size
  buf.writeUInt16LE(1, 20)        // PCM format
  buf.writeUInt16LE(1, 22)        // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buf.writeUInt16LE(2, 32)        // block align
  buf.writeUInt16LE(16, 34)       // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  Buffer.from(pcmData).copy(buf, 44)
  return buf
}

function createGeminiSTTAdapter(apiKey: string): STTAdapter {
  const genAI = new GoogleGenerativeAI(apiKey)
  const fileManager = new GoogleAIFileManager(apiKey)

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object,
  })

  async function waitForFile(name: string): Promise<void> {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const file = await fileManager.getFile(name)
      if (file.state === FileState.ACTIVE) return
      if (file.state === FileState.FAILED) throw new Error('Gemini file processing failed')
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('Gemini file processing timed out')
  }

  async function transcribeAudioFile(
    fileUri: string,
    mimeType: string,
  ): Promise<TranscriptSegment[]> {
    const result = await model.generateContent([
      { fileData: { mimeType, fileUri } },
      {
        text: `Transcribe this audio with speaker diarization.
Return a JSON array (no markdown fences):
[{"speaker":"Speaker 1","text":"...","start":0.0,"end":2.5},...]

Rules:
- Use "Speaker 1", "Speaker 2", etc. for speaker labels
- start/end in seconds (float)
- Include all spoken words
- Respond with ONLY the JSON array`,
      },
    ])

    const raw = result.response.text().trim()
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) return []
      const parsed = JSON.parse(match[0]) as Array<{
        speaker: string; text: string; start: number; end: number
      }>
      return parsed.map((s) => ({
        speaker: s.speaker ?? 'Speaker 1',
        text: s.text ?? '',
        start: s.start ?? 0,
        end: s.end ?? 0,
      }))
    } catch {
      return []
    }
  }

  return {
    async transcribeFile(filePath: string): Promise<TranscriptSegment[]> {
      const { basename } = await import('path')
      const ext = filePath.split('.').pop()?.toLowerCase() ?? 'webm'
      const mimeType = ext === 'mp3' ? 'audio/mpeg'
        : ext === 'wav' ? 'audio/wav'
        : ext === 'mp4' ? 'video/mp4'
        : 'audio/webm'

      const uploadRes = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName: basename(filePath),
      })
      await waitForFile(uploadRes.file.name)

      const segments = await transcribeAudioFile(uploadRes.file.uri, mimeType)
      fileManager.deleteFile(uploadRes.file.name).catch(() => undefined)
      return segments
    },

    async *streamTranscribe(
      audioStream: ReadableStream<Uint8Array>,
      options?: { languageCode?: string },
    ): AsyncIterable<PartialTranscript> {
      const langHint = options?.languageCode
        ? `The audio is in language code "${options.languageCode}". `
        : ''
      // Gemini has no true WebSocket streaming STT.
      // Strategy: buffer 3s of PCM audio → send inline to Gemini → yield partial.
      // Similar latency to AssemblyAI v3, but only 1 API key needed.
      const CHUNK_DURATION_MS = 3000
      const BYTES_PER_CHUNK = STT_SAMPLE_RATE * 2 * (CHUNK_DURATION_MS / 1000) // 96000 bytes

      const reader = audioStream.getReader()
      let buffer = new Uint8Array(0)
      let chunkIndex = 0

      const processChunk = async (pcm: Uint8Array): Promise<PartialTranscript | null> => {
        try {
          const wav = buildWavBuffer(pcm, STT_SAMPLE_RATE)
          const b64 = wav.toString('base64')
          const result = await model.generateContent([
            { inlineData: { mimeType: 'audio/wav', data: b64 } },
            {
              text: `${langHint}Transcribe this audio clip exactly as spoken. Keep the original language — do NOT translate. Return only the spoken text as a plain string. If silent or inaudible, return empty string.`,
            },
          ])
          const text = result.response.text().trim()
          if (!text) return null
          return {
            text,
            isFinal: true, // each 3s window is a complete segment, not a partial update
            speaker: 'Speaker 1',
            start: chunkIndex * (CHUNK_DURATION_MS / 1000),
          }
        } catch (err) {
          console.error('[GeminiSTT] chunk error:', err)
          return null
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const merged = new Uint8Array(buffer.length + value.length)
          merged.set(buffer)
          merged.set(value, buffer.length)
          buffer = merged

          while (buffer.length >= BYTES_PER_CHUNK) {
            const chunk = buffer.slice(0, BYTES_PER_CHUNK)
            buffer = buffer.slice(BYTES_PER_CHUNK)
            const partial = await processChunk(chunk)
            if (partial) yield partial
            chunkIndex++
          }
        }

        // Flush remaining audio (< 3s)
        if (buffer.length > STT_SAMPLE_RATE * 2 * 0.5) { // at least 0.5s
          const partial = await processChunk(buffer)
          if (partial) yield { ...partial, isFinal: true }
        }
      } finally {
        reader.releaseLock()
      }
    },
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Lazy factory — reads keys from settings at call time so that user can
 * configure keys via Settings page without restarting the server.
 *
 * Key resolution: settings file first, then env var fallback.
 */
export const stt: STTAdapter = {
  async transcribeFile(filePath: string): Promise<TranscriptSegment[]> {
    const settings = await getSettings()
    const provider = settings.sttProvider || config.sttProvider

    switch (provider) {
      case 'assemblyai': {
        const key = settings.apiKeys.assemblyai || config.assemblyaiKey
        if (!key) throw new Error('AssemblyAI API key not configured. Go to Settings to add your key.')
        return createAssemblyAIAdapter(key).transcribeFile(filePath)
      }
      case 'deepgram': {
        const key = settings.apiKeys.deepgram || config.deepgramKey
        if (!key) throw new Error('Deepgram API key not configured. Go to Settings to add your key.')
        return createDeepgramAdapter(key).transcribeFile(filePath)
      }
      case 'gemini': {
        const key = settings.apiKeys.gemini || config.geminiApiKey
        if (!key) throw new Error('Gemini API key not configured. Go to Settings to add your key.')
        return createGeminiSTTAdapter(key).transcribeFile(filePath)
      }
      default:
        throw new Error(`Unknown STT provider: ${String(provider)}`)
    }
  },

  async *streamTranscribe(
    audioStream: ReadableStream<Uint8Array>,
    options?: { languageCode?: string },
  ): AsyncIterable<PartialTranscript> {
    const settings = await getSettings()
    const provider = settings.sttProvider || config.sttProvider
    const assemblyKey = settings.apiKeys.assemblyai || config.assemblyaiKey
    const geminiKey = settings.apiKeys.gemini || config.geminiApiKey

    if (provider === 'gemini') {
      if (!geminiKey) throw new Error('Gemini API key not configured.')
      yield* createGeminiSTTAdapter(geminiKey).streamTranscribe(audioStream, options)
      return
    }

    if (provider === 'deepgram') {
      const key = settings.apiKeys.deepgram || config.deepgramKey
      if (!key) throw new Error('Deepgram API key not configured.')
      yield* createDeepgramAdapter(key).streamTranscribe(audioStream, options)
      return
    }

    // assemblyai (default)
    if (!assemblyKey) throw new Error('AssemblyAI API key not configured. Go to Settings to add your key.')

    if (options?.languageCode === 'en' || !geminiKey) {
      // English explicit, or no Gemini key → AssemblyAI only
      yield* createAssemblyAIAdapter(assemblyKey).streamTranscribe(audioStream, options)
    } else {
      // Vietnamese + auto-detect → Gemini (accurate multilingual, 3s batches)
      yield* createGeminiSTTAdapter(geminiKey).streamTranscribe(audioStream, options)
    }
  },
}
