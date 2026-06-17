import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { Mic, FileText, Globe, Youtube, Video, Headphones, History, Settings } from 'lucide-react';
const SOURCE_TABS = [
    { kind: 'live', label: 'Live recording', icon: _jsx(Mic, { size: 15 }), route: '/live' },
    { kind: 'youtube', label: 'YouTube', icon: _jsx(Youtube, { size: 15 }), route: '/import/youtube' },
    { kind: 'pdf', label: 'PDF', icon: _jsx(FileText, { size: 15 }), route: '/import/pdf' },
    { kind: 'web', label: 'Website', icon: _jsx(Globe, { size: 15 }), route: '/import/web' },
    { kind: 'video', label: 'Video / Audio', icon: _jsx(Video, { size: 15 }), route: '/import/video' },
    { kind: 'audio', label: 'Audio file', icon: _jsx(Headphones, { size: 15 }), route: '/import/audio' },
];
export default function HomePage() {
    const navigate = useNavigate();
    const activeKind = 'live';
    return (_jsxs("main", { className: "min-h-screen bg-bg flex flex-col items-center pt-16 px-6", children: [_jsxs("div", { className: "w-full max-w-content flex justify-end gap-4 mb-6", children: [_jsxs("button", { onClick: () => navigate('/sessions'), className: "flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors", children: [_jsx(History, { size: 15 }), "Sessions"] }), _jsxs("button", { onClick: () => navigate('/settings'), className: "flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors", children: [_jsx(Settings, { size: 15 }), "Settings"] })] }), _jsx("h1", { className: "text-display mb-2", children: "Import sources" }), _jsx("p", { className: "text-body text-text-2 mb-8", children: "Choose how you want to add content" }), _jsx("nav", { className: "flex flex-wrap gap-1 bg-surface border border-border rounded-full p-1 mb-10", children: SOURCE_TABS.map((tab) => (_jsxs("button", { onClick: () => navigate(tab.route), className: `flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-medium
                        transition-colors select-none
                        ${tab.kind === activeKind
                        ? 'bg-primary text-white'
                        : 'text-text-2 hover:text-text hover:bg-surface-2'}`, children: [tab.icon, tab.label] }, tab.kind))) }), _jsxs("div", { className: "card w-full max-w-content space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-heading font-semibold", children: "Live Recording" }), _jsx("p", { className: "text-small text-text-2 mt-1", children: "Record meetings in real-time. Supports mic + system audio. Auto speaker detection, auto language detection. Generates meeting minutes after you stop." })] }), _jsxs("div", { className: "flex flex-col gap-2 text-small text-text-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-accent" }), "Real-time transcript with speaker labels"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-accent" }), "Two-pass processing for accurate diarization"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-accent" }), "Meeting minutes with action items"] })] }), _jsxs("button", { onClick: () => navigate('/live'), className: "btn-primary flex items-center justify-center gap-2 w-full py-3", children: [_jsx(Mic, { size: 16 }), "Start Recording"] })] })] }));
}
//# sourceMappingURL=HomePage.js.map