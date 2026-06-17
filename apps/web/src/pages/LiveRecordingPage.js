import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, ArrowLeft, AlertCircle, Pencil, Check, Globe, Download } from 'lucide-react';
import { formatDuration } from '@transcript/shared';
import { useLiveRecording } from '../hooks/useLiveRecording.js';
import { useAppSettings } from '../App.js';
import Waveform from '../components/Waveform.js';
import LiveTranscriptFeed from '../components/LiveTranscriptFeed.js';
import { api } from '../api/client.js';
export default function LiveRecordingPage() {
    const navigate = useNavigate();
    const { settings } = useAppSettings();
    const defaultSourceLang = settings?.liveRecording.defaultSourceLang ?? 'en';
    const defaultTranslateLang = settings?.liveRecording.defaultTranslateLang ?? 'vi';
    const { status, lines, sessionId, reportId, sessionCost, errorMessage, audioLevel, duration, recordedDuration, translateLang, setTranslateLang, sourceLang, setSourceLang, startRecording, stopRecording, downloadAudio, } = useLiveRecording({ initialSourceLang: defaultSourceLang, initialTranslateLang: defaultTranslateLang });
    const [speakerNames, setSpeakerNames] = useState({});
    const [editingSpeaker, setEditingSpeaker] = useState(null);
    const [editValue, setEditValue] = useState('');
    // Unique speakers from transcript
    const speakers = [...new Set(lines.map((l) => l.speaker))];
    async function handleRenameSpeaker(label) {
        if (!sessionId || !editValue.trim())
            return;
        const name = editValue.trim();
        setSpeakerNames((prev) => ({ ...prev, [label]: name }));
        setEditingSpeaker(null);
        setEditValue('');
        try {
            await api.sessions.renameSpeaker(sessionId, label, name);
        }
        catch {
            // Non-critical: local rename already applied
        }
    }
    // Navigate to report when done
    useEffect(() => {
        if (status === 'done' && reportId) {
            navigate(`/session/${sessionId ?? ''}/report/${reportId}`, { state: { cost: sessionCost } });
        }
    }, [status, reportId, sessionId, sessionCost, navigate]);
    return (_jsxs("main", { className: "min-h-screen bg-bg", children: [_jsxs("header", { className: "sticky top-0 z-10 bg-surface border-b border-border h-14 flex items-center px-6 gap-4", children: [_jsxs("button", { onClick: () => navigate('/'), className: "flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors", children: [_jsx(ArrowLeft, { size: 15 }), "Back"] }), _jsx("div", { className: "h-4 w-px bg-border" }), _jsx("h1", { className: "text-heading", children: "Live Recording" }), status === 'idle' && (_jsx("p", { className: "ml-auto text-tiny text-text-3 max-w-xs text-right", children: "Please inform all participants before recording." }))] }), _jsxs("div", { className: "max-w-content mx-auto px-6 py-10 space-y-6", children: [status === 'idle' && (_jsxs("div", { className: "card space-y-6", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Globe, { size: 14, className: "text-text-2" }), _jsx("span", { className: "text-body font-medium", children: "Ng\u00F4n ng\u1EEF n\u00F3i" })] }), _jsx("div", { className: "flex gap-2 flex-wrap", children: [null, 'vi', 'en'].map((lang) => (_jsx("button", { onClick: () => setSourceLang(lang), className: `px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${sourceLang === lang
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border text-text-2 hover:text-text hover:border-border-2'}`, children: lang === null ? 'Tự động' : lang === 'vi' ? 'Tiếng Việt' : 'English' }, lang ?? 'auto'))) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Globe, { size: 14, className: "text-text-2" }), _jsx("span", { className: "text-body font-medium", children: "Translate transcript to" })] }), _jsx("div", { className: "flex gap-2", children: [null, 'vi', 'en', 'fr'].map((lang) => (_jsx("button", { onClick: () => setTranslateLang(lang), className: `px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${translateLang === lang
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border text-text-2 hover:text-text hover:border-border-2'}`, children: lang === null ? 'Off' : lang === 'vi' ? 'Tiếng Việt' : lang === 'en' ? 'English' : 'Français' }, lang ?? 'off'))) })] }), _jsxs("button", { onClick: () => void startRecording(), className: "btn-primary w-full flex items-center justify-center gap-2 py-3", children: [_jsx(Mic, { size: 16 }), "Start Recording"] })] })), (status === 'recording') && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" }), _jsx("span", { className: "font-mono text-title tabular-nums", children: formatDuration(duration) })] }), _jsx(Waveform, { level: audioLevel, isActive: status === 'recording' }), _jsxs("button", { onClick: stopRecording, className: "flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white\n                             font-semibold px-5 py-2.5 rounded-md transition-colors text-body", children: [_jsx(Square, { size: 14, fill: "currentColor" }), "Stop"] })] }), _jsxs("div", { className: "border-t border-border pt-5", children: [_jsx("p", { className: "text-tiny text-text-3 uppercase tracking-wide font-medium mb-4", children: "Live transcript" }), _jsx(LiveTranscriptFeed, { lines: lines, speakerNames: speakerNames })] })] }), speakers.length > 0 && (_jsxs("div", { className: "card", children: [_jsx("p", { className: "text-small font-medium text-text-2 mb-4", children: "Rename speakers" }), _jsx("div", { className: "space-y-2", children: speakers.map((speaker) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-tiny tag-default w-24 shrink-0", children: speaker }), editingSpeaker === speaker ? (_jsxs("div", { className: "flex items-center gap-2 flex-1", children: [_jsx("input", { className: "input py-1.5 text-small", value: editValue, onChange: (e) => setEditValue(e.target.value), onKeyDown: (e) => {
                                                                if (e.key === 'Enter')
                                                                    void handleRenameSpeaker(speaker);
                                                                if (e.key === 'Escape')
                                                                    setEditingSpeaker(null);
                                                            }, autoFocus: true }), _jsx("button", { onClick: () => void handleRenameSpeaker(speaker), className: "text-text-2 hover:text-text", children: _jsx(Check, { size: 16 }) })] })) : (_jsxs("div", { className: "flex items-center gap-2 flex-1", children: [_jsx("span", { className: "text-body", children: speakerNames[speaker] ?? speaker }), _jsx("button", { onClick: () => {
                                                                setEditingSpeaker(speaker);
                                                                setEditValue(speakerNames[speaker] ?? '');
                                                            }, className: "text-text-3 hover:text-text-2 ml-auto", children: _jsx(Pencil, { size: 13 }) })] }))] }, speaker))) })] }))] })), status === 'processing' && (_jsxs("div", { className: "card flex flex-col items-center py-12 gap-4", children: [_jsx("div", { className: "w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-heading font-semibold", children: "Generating meeting minutes" }), _jsx("p", { className: "text-small text-text-2 mt-1", children: "Re-processing audio for accuracy, then generating report\u2026" })] }), recordedDuration > 0 && (_jsxs("button", { onClick: downloadAudio, className: "btn-secondary flex items-center gap-2 text-small py-2 px-4 mt-2", children: [_jsx(Download, { size: 14 }), "Download audio (", formatDuration(recordedDuration), ")"] }))] })), status === 'error' && (_jsx("div", { className: "card border-red-200 bg-red-50", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(AlertCircle, { size: 18, className: "text-red-500 shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "text-body font-medium text-red-700", children: "Recording failed" }), _jsx("p", { className: "text-small text-red-600 mt-1", children: errorMessage }), _jsx("button", { onClick: () => window.location.reload(), className: "btn-secondary mt-4 text-small py-2", children: "Try again" })] })] }) }))] })] }));
}
//# sourceMappingURL=LiveRecordingPage.js.map