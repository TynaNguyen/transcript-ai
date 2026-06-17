import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Scrolling transcript feed hiển thị real-time
 */
import { useEffect, useRef } from 'react';
import { formatTimestamp } from '@transcript/shared';
const SPEAKER_COLORS = [
    'text-blue-600',
    'text-purple-600',
    'text-green-600',
    'text-orange-600',
    'text-pink-600',
];
function getSpeakerColor(speaker) {
    const num = parseInt(speaker.replace(/\D/g, '') || '1', 10) - 1;
    return SPEAKER_COLORS[num % SPEAKER_COLORS.length] ?? SPEAKER_COLORS[0];
}
export default function LiveTranscriptFeed({ lines, speakerNames }) {
    const bottomRef = useRef(null);
    // Auto-scroll to bottom as transcript grows
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines]);
    if (lines.length === 0) {
        return (_jsx("div", { className: "flex items-center justify-center h-32 text-text-3 text-small", children: "Transcript will appear here..." }));
    }
    return (_jsxs("div", { className: "space-y-3 max-h-72 overflow-y-auto pr-2", children: [lines.map((line) => {
                const displayName = speakerNames[line.speaker] ?? line.speaker;
                const colorClass = getSpeakerColor(line.speaker);
                return (_jsxs("div", { className: `transition-opacity ${line.isFinal ? 'opacity-100' : 'opacity-60'}`, children: [_jsxs("div", { className: "flex items-baseline gap-2 mb-0.5", children: [_jsx("span", { className: `text-tiny font-semibold uppercase tracking-wide ${colorClass}`, children: displayName }), line.start !== undefined && (_jsx("span", { className: "text-tiny text-text-3 font-mono", children: formatTimestamp(line.start) }))] }), _jsxs("p", { className: "text-body text-text leading-relaxed", children: [line.text, !line.isFinal && (_jsx("span", { className: "inline-block w-0.5 h-4 bg-text-2 ml-0.5 align-middle animate-pulse" }))] }), line.translating && (_jsxs("p", { className: "text-small text-text-3 mt-0.5 flex items-center gap-1.5", children: [_jsx("span", { className: "inline-block w-3 h-3 border border-text-3 border-t-transparent rounded-full animate-spin" }), "Translating\u2026"] })), line.translation && !line.translating && (_jsx("p", { className: "text-small text-accent mt-0.5 leading-relaxed", children: line.translation }))] }, line.id));
            }), _jsx("div", { ref: bottomRef })] }));
}
//# sourceMappingURL=LiveTranscriptFeed.js.map