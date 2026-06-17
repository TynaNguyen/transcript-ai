import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, X, Pin, PinOff } from 'lucide-react'
import { formatDuration } from '@transcript/shared'
import { useLiveRecording } from '../hooks/useLiveRecording.js'
import { useAppSettings } from '../App.js'
import LiveTranscriptFeed from '../components/LiveTranscriptFeed.js'

export default function CompactRecordingPage() {
  const navigate = useNavigate()
  const { settings } = useAppSettings()
  const defaultSourceLang = settings?.liveRecording.defaultSourceLang ?? 'en'
  const defaultTranslateLang = settings?.liveRecording.defaultTranslateLang ?? 'vi'

  const {
    status, lines, sessionId, reportId, sessionCost,
    errorMessage, duration, translateLang, setTranslateLang,
    sourceLang, setSourceLang, startRecording, stopRecording,
  } = useLiveRecording({ initialSourceLang: defaultSourceLang, initialTranslateLang: defaultTranslateLang })

  const [isPinned, setIsPinned] = useState(true)
  const [speakerNames] = useState<Record<string, string>>({})

  function togglePin() {
    const next = !isPinned
    setIsPinned(next)
    window.electronCompact?.setPinned(next)
  }

  useEffect(() => {
    if (status === 'done' && reportId && sessionId) {
      navigate(`/session/${sessionId}/report/${reportId}`, { state: { cost: sessionCost } })
    }
  }, [status, reportId, sessionId, sessionCost, navigate])

  return (
    <main className="h-screen bg-surface flex flex-col overflow-hidden select-none border border-border rounded-t-xl shadow-2xl">

      {/* ── Title bar (drag region) ── */}
      <header className="drag-region shrink-0 h-11 bg-surface border-b border-border flex items-center px-4 gap-3 rounded-t-xl">

        {status === 'recording' ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="font-mono text-small tabular-nums text-text font-semibold">
              {formatDuration(duration)}
            </span>
          </div>
        ) : (
          <span className="text-small font-semibold text-text">Transcript AI</span>
        )}

        <div className="ml-auto no-drag flex items-center gap-1.5">
          {status === 'recording' && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white
                         text-small font-semibold px-3 py-1 rounded-md transition-colors"
            >
              <Square size={11} fill="currentColor" />
              Stop
            </button>
          )}

          <button
            onClick={togglePin}
            title={isPinned ? 'Unpin' : 'Pin on top'}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              isPinned
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-text-3 hover:text-text hover:bg-border'
            }`}
          >
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>

          <button
            onClick={() => window.close()}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-3
                       hover:text-text hover:bg-border transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* Idle: two-column language config + start button */}
        {status === 'idle' && (
          <div className="flex-1 flex flex-col justify-between p-4 gap-3">
            <div className="flex gap-6">
              <div className="space-y-1.5">
                <p className="text-tiny text-text-3 font-medium uppercase tracking-widest">Speaking</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([null, 'vi', 'en'] as const).map((lang) => (
                    <button
                      key={lang ?? 'auto'}
                      onClick={() => setSourceLang(lang)}
                      className={`px-2.5 py-1 rounded-md text-small font-medium border transition-colors ${
                        sourceLang === lang
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-text-2 hover:text-text hover:border-border-2'
                      }`}
                    >
                      {lang === null ? 'Auto' : lang === 'vi' ? 'Tiếng Việt' : 'English'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-tiny text-text-3 font-medium uppercase tracking-widest">Translate to</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([null, 'vi', 'en', 'fr'] as const).map((lang) => (
                    <button
                      key={lang ?? 'off'}
                      onClick={() => setTranslateLang(lang)}
                      className={`px-2.5 py-1 rounded-md text-small font-medium border transition-colors ${
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
            </div>

            <button
              onClick={() => void startRecording()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              <Mic size={15} />
              Start Recording
            </button>
          </div>
        )}

        {/* Recording: transcript feed */}
        {status === 'recording' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {lines.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-small text-text-3">Listening…</p>
              </div>
            ) : (
              <LiveTranscriptFeed lines={lines} speakerNames={speakerNames} />
            )}
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-small text-text-2">Generating report…</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="p-4 flex items-center gap-3">
            <p className="text-small text-red-600 flex-1">{errorMessage}</p>
            <button onClick={() => window.location.reload()} className="text-tiny text-text-2 underline shrink-0">
              Retry
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
