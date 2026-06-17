/**
 * Scrolling transcript feed hiển thị real-time
 */

import { useEffect, useRef } from 'react'
import { formatTimestamp } from '@transcript/shared'
import type { LiveTranscriptLine } from '../hooks/useLiveRecording.js'

interface LiveTranscriptFeedProps {
  lines: LiveTranscriptLine[]
  speakerNames: Record<string, string>  // label → display name
}

const SPEAKER_COLORS = [
  'text-blue-600',
  'text-purple-600',
  'text-green-600',
  'text-orange-600',
  'text-pink-600',
]

function getSpeakerColor(speaker: string): string {
  const num = parseInt(speaker.replace(/\D/g, '') || '1', 10) - 1
  return SPEAKER_COLORS[num % SPEAKER_COLORS.length] ?? SPEAKER_COLORS[0]!
}

export default function LiveTranscriptFeed({ lines, speakerNames }: LiveTranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as transcript grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-3 text-small">
        Transcript will appear here...
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
      {lines.map((line) => {
        const displayName = speakerNames[line.speaker] ?? line.speaker
        const colorClass = getSpeakerColor(line.speaker)

        return (
          <div
            key={line.id}
            className={`transition-opacity ${line.isFinal ? 'opacity-100' : 'opacity-60'}`}
          >
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className={`text-tiny font-semibold uppercase tracking-wide ${colorClass}`}>
                {displayName}
              </span>
              {line.start !== undefined && (
                <span className="text-tiny text-text-3 font-mono">
                  {formatTimestamp(line.start)}
                </span>
              )}
            </div>
            <p className="text-body text-text leading-relaxed">
            {line.text}
            {!line.isFinal && (
              <span className="inline-block w-0.5 h-4 bg-text-2 ml-0.5 align-middle animate-pulse" />
            )}
          </p>

            {/* Translation */}
            {line.translating && (
              <p className="text-small text-text-3 mt-0.5 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border border-text-3 border-t-transparent rounded-full animate-spin" />
                Translating…
              </p>
            )}
            {line.translation && !line.translating && (
              <p className="text-small text-accent mt-0.5 leading-relaxed">
                {line.translation}
              </p>
            )}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
