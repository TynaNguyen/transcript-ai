/**
 * Live Recording Page
 *
 * Layout:
 *   Header: title + legal notice
 *   Controls: Record/Stop button + timer + waveform
 *   Transcript: scrolling live feed
 *   Speaker panel: rename speakers
 *   Processing state: spinner + "Generating report..."
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, ArrowLeft, AlertCircle, Pencil, Check, Globe, Download } from 'lucide-react'
import { formatDuration } from '@transcript/shared'
import { useLiveRecording } from '../hooks/useLiveRecording.js'
import { useAppSettings } from '../App.js'
import Waveform from '../components/Waveform.js'
import LiveTranscriptFeed from '../components/LiveTranscriptFeed.js'
import { api } from '../api/client.js'

export default function LiveRecordingPage() {
  const navigate = useNavigate()
  const { settings } = useAppSettings()
  const defaultSourceLang = settings?.liveRecording.defaultSourceLang ?? 'en'
  const defaultTranslateLang = settings?.liveRecording.defaultTranslateLang ?? 'vi'
  const {
    status,
    lines,
    sessionId,
    reportId,
    sessionCost,
    errorMessage,
    audioLevel,
    duration,
    recordedDuration,
    translateLang,
    setTranslateLang,
    sourceLang,
    setSourceLang,
    startRecording,
    stopRecording,
    downloadAudio,
  } = useLiveRecording({ initialSourceLang: defaultSourceLang, initialTranslateLang: defaultTranslateLang })

  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({})
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Unique speakers from transcript
  const speakers = [...new Set(lines.map((l) => l.speaker))]

  async function handleRenameSpeaker(label: string) {
    if (!sessionId || !editValue.trim()) return
    const name = editValue.trim()
    setSpeakerNames((prev) => ({ ...prev, [label]: name }))
    setEditingSpeaker(null)
    setEditValue('')
    try {
      await api.sessions.renameSpeaker(sessionId, label, name)
    } catch {
      // Non-critical: local rename already applied
    }
  }

  // Navigate to report when done
  useEffect(() => {
    if (status === 'done' && reportId && sessionId) {
      // In compact mode, navigate within the window — main.ts detects this and resizes the window to full size
      navigate(`/session/${sessionId}/report/${reportId}`, { state: { cost: sessionCost } })
    }
  }, [status, reportId, sessionId, sessionCost, navigate])


  return (
    <main className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface border-b border-border h-14 flex items-center px-6 gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-heading">Live Recording</h1>

        {/* Legal notice */}
        {status === 'idle' && (
          <p className="ml-auto text-tiny text-text-3 max-w-xs text-right">
            Please inform all participants before recording.
          </p>
        )}
      </header>

      <div className="max-w-content mx-auto px-6 py-10 space-y-6">

        {/* ── Idle state ── */}
        {status === 'idle' && (
          <div className="card space-y-6">
            {/* Source language — spoken language for STT */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe size={14} className="text-text-2" />
                <span className="text-body font-medium">Ngôn ngữ nói</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {([null, 'vi', 'en'] as const).map((lang) => (
                  <button
                    key={lang ?? 'auto'}
                    onClick={() => setSourceLang(lang)}
                    className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${
                      sourceLang === lang
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-text-2 hover:text-text hover:border-border-2'
                    }`}
                  >
                    {lang === null ? 'Tự động' : lang === 'vi' ? 'Tiếng Việt' : 'English'}
                  </button>
                ))}
              </div>
            </div>

            {/* Real-time translation toggle */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe size={14} className="text-text-2" />
                <span className="text-body font-medium">Translate transcript to</span>
              </div>
              <div className="flex gap-2">
                {([null, 'vi', 'en', 'fr'] as const).map((lang) => (
                  <button
                    key={lang ?? 'off'}
                    onClick={() => setTranslateLang(lang)}
                    className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${
                      translateLang === lang
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-text-2 hover:text-text hover:border-border-2'
                    }`}
                  >
                    {lang === null ? 'Off' : lang === 'vi' ? 'Tiếng Việt' : lang === 'en' ? 'English' : 'Français'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => void startRecording()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              <Mic size={16} />
              Start Recording
            </button>
          </div>
        )}

        {/* ── Recording state ── */}
        {(status === 'recording') && (
          <>
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                {/* Timer + recording dot */}
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono text-title tabular-nums">
                    {formatDuration(duration)}
                  </span>
                </div>

                {/* Waveform */}
                <Waveform level={audioLevel} isActive={status === 'recording'} />

                {/* Stop button */}
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white
                             font-semibold px-5 py-2.5 rounded-md transition-colors text-body"
                >
                  <Square size={14} fill="currentColor" />
                  Stop
                </button>
              </div>

              {/* Live transcript */}
              <div className="border-t border-border pt-5">
                <p className="text-tiny text-text-3 uppercase tracking-wide font-medium mb-4">
                  Live transcript
                </p>
                <LiveTranscriptFeed lines={lines} speakerNames={speakerNames} />
              </div>
            </div>

            {/* Speaker rename (shows once speakers appear) */}
            {speakers.length > 0 && (
              <div className="card">
                <p className="text-small font-medium text-text-2 mb-4">Rename speakers</p>
                <div className="space-y-2">
                  {speakers.map((speaker) => (
                    <div key={speaker} className="flex items-center gap-3">
                      <span className="text-tiny tag-default w-24 shrink-0">{speaker}</span>
                      {editingSpeaker === speaker ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            className="input py-1.5 text-small"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleRenameSpeaker(speaker)
                              if (e.key === 'Escape') setEditingSpeaker(null)
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => void handleRenameSpeaker(speaker)}
                            className="text-text-2 hover:text-text"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-body">
                            {speakerNames[speaker] ?? speaker}
                          </span>
                          <button
                            onClick={() => {
                              setEditingSpeaker(speaker)
                              setEditValue(speakerNames[speaker] ?? '')
                            }}
                            className="text-text-3 hover:text-text-2 ml-auto"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Processing state ── */}
        {status === 'processing' && (
          <div className="card flex flex-col items-center py-12 gap-4">
            <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-heading font-semibold">Generating meeting minutes</p>
              <p className="text-small text-text-2 mt-1">
                Re-processing audio for accuracy, then generating report…
              </p>
            </div>
            {recordedDuration > 0 && (
              <button
                onClick={downloadAudio}
                className="btn-secondary flex items-center gap-2 text-small py-2 px-4 mt-2"
              >
                <Download size={14} />
                Download audio ({formatDuration(recordedDuration)})
              </button>
            )}
          </div>
        )}

        {/* ── Error state ── */}
        {status === 'error' && (
          <div className="card border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-body font-medium text-red-700">Recording failed</p>
                <p className="text-small text-red-600 mt-1">{errorMessage}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-secondary mt-4 text-small py-2"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
