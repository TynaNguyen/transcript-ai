import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * IngestPage — unified import page cho YouTube, PDF, Web, Video, Audio
 * Mỗi tab là 1 panel riêng. Sau khi submit → navigate /session/:id/report/:reportId
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, Youtube, FileText, Globe, Video, Headphones, Upload, AlertCircle, Check, History } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../components/Toast.js';
const ALL_TABS = [
    { kind: 'live', label: 'Live recording', icon: _jsx(Mic, { size: 15 }), route: '/live' },
    { kind: 'youtube', label: 'YouTube', icon: _jsx(Youtube, { size: 15 }), route: '/import/youtube' },
    { kind: 'pdf', label: 'PDF', icon: _jsx(FileText, { size: 15 }), route: '/import/pdf' },
    { kind: 'web', label: 'Website', icon: _jsx(Globe, { size: 15 }), route: '/import/web' },
    { kind: 'video', label: 'Video file', icon: _jsx(Video, { size: 15 }), route: '/import/video' },
    { kind: 'audio', label: 'Audio file', icon: _jsx(Headphones, { size: 15 }), route: '/import/audio' },
];
const TABS = ALL_TABS.filter((t) => t.kind !== 'live');
const ACCEPT = {
    pdf: '.pdf,application/pdf',
    video: '.mp4,.mov,.avi,.mkv,.webm',
    audio: '.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm',
};
const HINT = {
    youtube: 'Paste a YouTube URL with captions (talks, lectures, podcasts, interviews). Music videos without captions won\'t work.',
    pdf: 'Upload a PDF — Gemini extracts and structures the full text.',
    web: 'Paste any webpage URL — article, doc, or blog post.',
    video: 'Upload a video file (mp4, mov, mkv…) — Gemini extracts the transcript.',
    audio: 'Upload an audio file (mp3, wav, m4a…) — transcribed with speaker diarization.',
};
// Steps shown while processing
const STEPS = {
    youtube: ['Fetching captions', 'Analyzing with Gemini', 'Generating report'],
    pdf: ['Uploading file', 'Extracting text', 'Generating report'],
    web: ['Fetching page', 'Parsing content', 'Generating report'],
    video: ['Uploading file', 'Transcribing audio', 'Generating report'],
    audio: ['Uploading file', 'Transcribing audio', 'Generating report'],
};
// Rough time per step in ms (visual only — for pacing the step indicator)
const STEP_DURATIONS = {
    youtube: [2000, 3000, 5000],
    pdf: [1000, 3000, 5000],
    web: [2000, 2000, 5000],
    video: [5000, 30000, 8000],
    audio: [3000, 20000, 8000],
};
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function IngestPage() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const params = useParams();
    const [activeKind, setActiveKind] = useState(params.kind ?? 'youtube');
    const isMounted = useRef(true);
    useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const fileRef = useRef(null);
    const stepTimers = useRef([]);
    // Advance step indicator while loading
    useEffect(() => {
        if (!loading) {
            stepTimers.current.forEach(clearTimeout);
            stepTimers.current = [];
            setCurrentStep(0);
            return;
        }
        const durations = STEP_DURATIONS[activeKind];
        let elapsed = 0;
        stepTimers.current = durations.map((d, i) => {
            elapsed += d;
            return setTimeout(() => setCurrentStep(i + 1), elapsed);
        });
        return () => stepTimers.current.forEach(clearTimeout);
    }, [loading, activeKind]);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        if (loading)
            return;
        const dropped = e.dataTransfer.files[0];
        if (dropped)
            setFile(dropped);
    }, [loading]);
    function switchTab(kind) {
        setActiveKind(kind);
        setUrl('');
        setFile(null);
        setError(null);
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            let result;
            switch (activeKind) {
                case 'youtube':
                    result = await api.ingest.youtube(url.trim());
                    break;
                case 'web':
                    result = await api.ingest.web(url.trim());
                    break;
                case 'pdf':
                    if (!file)
                        throw new Error('Please select a PDF file');
                    result = await api.ingest.pdf(file);
                    break;
                case 'video':
                    if (!file)
                        throw new Error('Please select a video file');
                    result = await api.ingest.video(file);
                    break;
                case 'audio':
                    if (!file)
                        throw new Error('Please select an audio file');
                    result = await api.ingest.audio(file);
                    break;
            }
            const navState = result.llmUsage ? { cost: { llm: result.llmUsage } } : undefined;
            if (isMounted.current) {
                navigate(`/session/${result.sessionId}/report/${result.reportId}`, { state: navState });
            }
            else {
                addToast({
                    title: 'Report ready',
                    message: `${activeKind.toUpperCase()} report has been generated.`,
                    action: {
                        label: 'View report',
                        onClick: () => navigate(`/session/${result.sessionId}/report/${result.reportId}`, { state: navState }),
                    },
                });
            }
        }
        catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'Something went wrong');
            }
        }
        finally {
            if (isMounted.current)
                setLoading(false);
        }
    }
    const isUrlKind = activeKind === 'youtube' || activeKind === 'web';
    const canSubmit = loading ? false : isUrlKind ? url.trim().length > 0 : file !== null;
    const steps = STEPS[activeKind];
    return (_jsxs("main", { className: "min-h-screen bg-bg flex flex-col items-center pt-16 px-6", children: [_jsx("div", { className: "w-full max-w-content flex justify-end mb-6", children: _jsxs("button", { onClick: () => navigate('/sessions'), className: "flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors", children: [_jsx(History, { size: 15 }), "Sessions"] }) }), _jsx("h1", { className: "text-display mb-2", children: "Import sources" }), _jsx("p", { className: "text-body text-text-2 mb-8", children: "Choose how you want to add content" }), _jsx("nav", { className: "flex flex-wrap gap-1 bg-surface border border-border rounded-full p-1 mb-10", children: ALL_TABS.map((tab) => (_jsxs("button", { onClick: () => {
                        if (tab.kind === 'live') {
                            navigate('/live');
                            return;
                        }
                        switchTab(tab.kind);
                        navigate(tab.route);
                    }, className: `flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-medium
                        transition-colors select-none
                        ${tab.kind === activeKind
                        ? 'bg-primary text-white'
                        : 'text-text-2 hover:text-text hover:bg-surface-2'}`, children: [tab.icon, tab.label] }, tab.kind))) }), _jsxs("form", { onSubmit: (e) => void handleSubmit(e), className: "card w-full max-w-content space-y-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-heading font-semibold capitalize", children: TABS.find((t) => t.kind === activeKind)?.label }), _jsx("p", { className: "text-small text-text-2 mt-1", children: HINT[activeKind] })] }), isUrlKind && (_jsx("input", { type: "text", value: url, onChange: (e) => setUrl(e.target.value), placeholder: activeKind === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...', disabled: loading, className: "input w-full", autoFocus: true, autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false })), !isUrlKind && (_jsxs("div", { onClick: () => !loading && fileRef.current?.click(), onDragOver: (e) => { e.preventDefault(); if (!loading)
                            setDragging(true); }, onDragLeave: () => setDragging(false), onDrop: handleDrop, className: `border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                        ${dragging ? 'border-primary bg-primary/10' : file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`, children: [_jsx("input", { ref: fileRef, type: "file", accept: ACCEPT[activeKind], className: "hidden", onChange: (e) => setFile(e.target.files?.[0] ?? null), disabled: loading }), _jsx(Upload, { size: 24, className: "mx-auto mb-2 text-text-3" }), file ? (_jsxs("div", { children: [_jsx("p", { className: "text-small font-medium text-text", children: file.name }), _jsx("p", { className: "text-tiny text-text-3 mt-0.5", children: formatFileSize(file.size) })] })) : (_jsx("p", { className: "text-small text-text-2", children: "Click to select or drag & drop" })), _jsx("p", { className: "text-tiny text-text-3 mt-1", children: (ACCEPT[activeKind] ?? '').replace(/\./g, '').toUpperCase() })] })), error && (_jsxs("div", { className: "flex items-start gap-2 text-small text-red-600 bg-red-50 border border-red-200 rounded-lg p-3", children: [_jsx(AlertCircle, { size: 15, className: "shrink-0 mt-0.5" }), _jsx("span", { children: error })] })), _jsx("button", { type: "submit", disabled: !canSubmit, className: "btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Working…' : 'Generate Report' }), loading && (_jsx("div", { className: "space-y-2 pt-1", children: steps.map((label, i) => {
                            const done = i < currentStep;
                            const active = i === currentStep;
                            return (_jsxs("div", { className: `flex items-center gap-2.5 text-small transition-opacity ${done || active ? 'opacity-100' : 'opacity-30'}`, children: [_jsx("div", { className: `w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors
                    ${done ? 'bg-green-500' : active ? 'bg-primary' : 'bg-border'}`, children: done
                                            ? _jsx(Check, { size: 10, className: "text-white" })
                                            : active
                                                ? _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-white animate-pulse" })
                                                : null }), _jsx("span", { className: done ? 'text-text-3 line-through' : active ? 'text-text font-medium' : 'text-text-3', children: label })] }, label));
                        }) }))] })] }));
}
//# sourceMappingURL=IngestPage.js.map