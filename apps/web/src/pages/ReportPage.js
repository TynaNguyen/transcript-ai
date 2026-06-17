import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Report Page — hiển thị meeting minutes sau khi recording xong
 *
 * Features:
 *   - Render markdown
 *   - Language toggle (EN / FR / VI)
 *   - Export buttons (md / docx / pdf)
 *   - Link back to session list
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Globe, Copy, Check, Send, Loader2, MessageSquare, Printer, ChevronDown, Pencil, Coins } from 'lucide-react';
import { api } from '../api/client.js';
import { LANGUAGE_LABELS } from '@transcript/shared';
function formatCost(usd) {
    if (usd === 0)
        return '$0.000';
    if (usd < 0.0001)
        return '< $0.0001';
    return `$${usd.toFixed(4)}`;
}
// Simple markdown renderer — replace with react-markdown in Phase 5 if needed
function renderMarkdown(md) {
    return md
        .replace(/^# (.+)$/gm, '<h1 class="text-title font-bold mt-6 mb-3">$1</h1>')
        .replace(/^## (.+)$/gm, '<h2 class="text-heading font-semibold mt-5 mb-2 text-text">$2</h2>'.replace('$2', '$1'))
        .replace(/^### (.+)$/gm, '<h3 class="text-body font-semibold mt-4 mb-1">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-surface-2 px-1 py-0.5 rounded text-small font-mono">$1</code>')
        .replace(/^\| (.+) \|$/gm, (row) => {
        const cells = row.slice(1, -1).split('|').map((c) => c.trim());
        const isSep = cells.every((c) => /^[-:]+$/.test(c));
        if (isSep)
            return '';
        const tag = 'td';
        return `<tr>${cells.map((c) => `<${tag} class="px-3 py-1.5 border-b border-border text-small">${c}</${tag}>`).join('')}</tr>`;
    })
        .replace(/(<tr>.*<\/tr>\n?)+/gs, (table) => `<div class="overflow-x-auto my-3"><table class="w-full border border-border rounded-md text-left">${table}</table></div>`)
        .replace(/^- (.+)$/gm, '<li class="text-body ml-4 list-disc">$1</li>')
        .replace(/((?:<li.*<\/li>\n?)+)/g, '<ul class="space-y-1 my-2">$1</ul>')
        .replace(/^(?!<[h|u|t|d]|\s*$)(.+)$/gm, '<p class="text-body leading-relaxed my-2">$1</p>')
        .replace(/\n\n+/g, '\n');
}
const TRANSLATE_LANGS = [
    { lang: 'en', label: 'EN' },
    { lang: 'fr', label: 'FR' },
    { lang: 'vi', label: 'VI' },
];
export default function ReportPage() {
    const { sessionId, reportId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const initialCost = location.state?.cost ?? null;
    // Accumulated LLM usage across report gen + translates + chats
    const [accUsage, setAccUsage] = useState(() => ({
        report: initialCost?.llm ?? null,
        extraTokens: 0,
        extraCost: 0,
    }));
    function addUsage(u) {
        if (!u)
            return;
        setAccUsage((prev) => ({
            ...prev,
            extraTokens: prev.extraTokens + u.inputTokens + u.outputTokens,
            extraCost: prev.extraCost + u.costUsd,
        }));
    }
    const [sessionType, setSessionType] = useState(null);
    const [sessionTitle, setSessionTitle] = useState('');
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState('');
    const titleInputRef = useRef(null);
    const titleEscapeRef = useRef(false);
    const [originalMd, setOriginalMd] = useState('');
    const [displayMd, setDisplayMd] = useState('');
    const [activeLang, setActiveLang] = useState('en');
    const [translating, setTranslating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const exportRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Chat state
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState(null);
    const chatBottomRef = useRef(null);
    useEffect(() => {
        if (!reportId)
            return;
        setLoading(true);
        let cancelled = false;
        // Retry up to 8 times with 1.5s delay — server may be restarting after tsx watch
        async function fetchWithRetry(attempts) {
            try {
                const data = await api.report.get(reportId);
                if (cancelled)
                    return;
                setOriginalMd(data.content_md);
                setDisplayMd(data.content_md);
            }
            catch (e) {
                if (cancelled)
                    return;
                if (attempts > 0) {
                    await new Promise((r) => setTimeout(r, 1500));
                    return fetchWithRetry(attempts - 1);
                }
                setError(String(e));
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        void fetchWithRetry(8);
        return () => { cancelled = true; };
    }, [reportId]);
    // Close export dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (exportRef.current && !exportRef.current.contains(e.target)) {
                setExportOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    // Load session type + title
    useEffect(() => {
        if (!sessionId)
            return;
        api.sessions.get(sessionId)
            .then((data) => {
            setSessionType(data.session.type);
            setSessionTitle(data.session.title);
            setTitleValue(data.session.title);
        })
            .catch(() => { });
    }, [sessionId]);
    useEffect(() => {
        if (editingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [editingTitle]);
    async function commitTitleRename() {
        if (titleEscapeRef.current) {
            titleEscapeRef.current = false;
            return;
        }
        const trimmed = titleValue.trim();
        setEditingTitle(false);
        if (!trimmed || trimmed === sessionTitle || !sessionId)
            return;
        const original = sessionTitle;
        setSessionTitle(trimmed);
        try {
            await api.sessions.rename(sessionId, trimmed);
        }
        catch {
            setSessionTitle(original);
        }
    }
    // Load chat history when session loads
    useEffect(() => {
        if (!sessionId)
            return;
        api.chat.history(sessionId)
            .then((msgs) => setChatMessages(msgs))
            .catch(() => { });
    }, [sessionId]);
    // Scroll chat to bottom on new messages
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);
    async function handleChatSend(e) {
        e.preventDefault();
        const msg = chatInput.trim();
        if (!msg || !sessionId || chatLoading)
            return;
        // Optimistic update
        const tempUser = { id: 'tmp-user', role: 'user', content: msg, created_at: new Date().toISOString() };
        setChatMessages((prev) => [...prev, tempUser]);
        setChatInput('');
        setChatError(null);
        setChatLoading(true);
        try {
            const result = await api.chat.send(sessionId, msg);
            const tempAssistant = { id: result.messageId, role: 'assistant', content: result.answer, created_at: new Date().toISOString() };
            setChatMessages((prev) => [...prev.filter((m) => m.id !== 'tmp-user'), tempUser, tempAssistant]);
            addUsage(result.llmUsage);
        }
        catch (err) {
            setChatMessages((prev) => prev.filter((m) => m.id !== 'tmp-user'));
            setChatError(err instanceof Error ? err.message : 'Failed to get a response');
        }
        finally {
            setChatLoading(false);
        }
    }
    async function handleTranslate(lang) {
        if (!reportId || lang === activeLang)
            return;
        if (lang === 'en') {
            setDisplayMd(originalMd);
            setActiveLang('en');
            return;
        }
        setTranslating(true);
        try {
            const result = await api.report.translate(reportId, lang);
            setDisplayMd(result.content);
            setActiveLang(lang);
            addUsage(result.llmUsage);
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            setTranslating(false);
        }
    }
    function handleCopy() {
        void navigator.clipboard.writeText(displayMd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    function handleExportMd() {
        const blob = new Blob([displayMd], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${sessionId ?? 'export'}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
    function handleExportDocx() {
        if (!reportId)
            return;
        // Direct browser download via anchor — no blob needed, server streams the file
        const a = document.createElement('a');
        a.href = api.report.exportDocxUrl(reportId);
        a.download = '';
        a.click();
    }
    function handlePrint() {
        window.print();
    }
    function handleDownloadAudio() {
        if (!sessionId)
            return;
        const a = document.createElement('a');
        a.href = api.sessions.audioUrl(sessionId);
        a.download = '';
        a.click();
    }
    return (_jsxs("main", { className: "h-screen flex flex-col bg-bg overflow-hidden", children: [_jsxs("header", { className: "sticky top-0 z-10 bg-surface border-b border-border h-14 flex-none flex items-center px-6 gap-4", children: [_jsxs("button", { onClick: () => navigate('/sessions'), className: "flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors", children: [_jsx(ArrowLeft, { size: 15 }), "Sessions"] }), _jsx("div", { className: "h-4 w-px bg-border" }), editingTitle ? (_jsx("input", { ref: titleInputRef, value: titleValue, onChange: (e) => setTitleValue(e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter')
                                e.currentTarget.blur();
                            if (e.key === 'Escape') {
                                titleEscapeRef.current = true;
                                setEditingTitle(false);
                                setTitleValue(sessionTitle);
                            }
                        }, onBlur: () => void commitTitleRename(), className: "input py-1 text-heading font-semibold w-64" })) : (_jsxs("button", { onClick: () => { setTitleValue(sessionTitle); setEditingTitle(true); }, className: "flex items-center gap-1.5 group text-left", children: [_jsx("h1", { className: "text-heading font-semibold truncate max-w-xs", children: sessionTitle || 'Meeting Report' }), _jsx(Pencil, { size: 13, className: "text-text-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" })] })), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsxs("div", { className: "flex items-center gap-1 bg-bg border border-border rounded-full p-1", children: [_jsx(Globe, { size: 13, className: "text-text-3 ml-1.5" }), TRANSLATE_LANGS.map(({ lang, label }) => (_jsx("button", { onClick: () => void handleTranslate(lang), disabled: translating, className: `px-3 py-1 rounded-full text-tiny font-medium transition-colors ${activeLang === lang
                                            ? 'bg-primary text-white'
                                            : 'text-text-2 hover:text-text'}`, children: label }, lang)))] }), _jsxs("button", { onClick: handleCopy, className: "btn-secondary py-2 px-3 flex items-center gap-1.5 text-small", children: [copied ? _jsx(Check, { size: 14 }) : _jsx(Copy, { size: 14 }), copied ? 'Copied' : 'Copy'] }), sessionType === 'live' && (_jsxs("button", { onClick: handleDownloadAudio, className: "btn-secondary py-2 px-3 flex items-center gap-1.5 text-small", children: [_jsx(Download, { size: 14 }), "Audio"] })), _jsxs("div", { ref: exportRef, className: "relative", children: [_jsxs("button", { onClick: () => setExportOpen((v) => !v), className: "btn-secondary py-2 px-3 flex items-center gap-1.5 text-small", children: [_jsx(Download, { size: 14 }), "Export", _jsx(ChevronDown, { size: 13, className: `transition-transform ${exportOpen ? 'rotate-180' : ''}` })] }), exportOpen && (_jsxs("div", { className: "absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-md py-1 w-40 z-20", children: [_jsxs("button", { onClick: () => { handleExportMd(); setExportOpen(false); }, className: "w-full flex items-center gap-2.5 px-3 py-2 text-small text-text hover:bg-surface-2 transition-colors", children: [_jsx(Download, { size: 13, className: "text-text-2" }), "Markdown (.md)"] }), _jsxs("button", { onClick: () => { handleExportDocx(); setExportOpen(false); }, className: "w-full flex items-center gap-2.5 px-3 py-2 text-small text-text hover:bg-surface-2 transition-colors", children: [_jsx(Download, { size: 13, className: "text-text-2" }), "Word (.docx)"] }), _jsx("div", { className: "h-px bg-border mx-2 my-1" }), _jsxs("button", { onClick: () => { handlePrint(); setExportOpen(false); }, className: "w-full flex items-center gap-2.5 px-3 py-2 text-small text-text hover:bg-surface-2 transition-colors", children: [_jsx(Printer, { size: 13, className: "text-text-2" }), "Print / PDF"] })] }))] })] })] }), _jsxs("div", { className: "flex-1 flex gap-6 overflow-hidden max-w-7xl mx-auto w-full px-6", children: [_jsxs("div", { className: "flex-1 min-w-0 overflow-y-auto py-10", children: [loading && (_jsx("div", { className: "card flex items-center justify-center py-16", children: _jsx("div", { className: "w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" }) })), error && (_jsx("div", { className: "card border-red-200 bg-red-50 text-red-700 text-body", children: error })), translating && (_jsxs("div", { className: "flex items-center gap-2 text-small text-text-2 mb-4", children: [_jsx("div", { className: "w-4 h-4 border border-border border-t-primary rounded-full animate-spin" }), "Translating to ", LANGUAGE_LABELS[activeLang], "..."] })), !loading && !error && (_jsx("article", { className: "card prose-none", 
                                // eslint-disable-next-line react/no-danger
                                dangerouslySetInnerHTML: { __html: renderMarkdown(displayMd) } }))] }), !loading && !error && sessionId && (_jsxs("aside", { className: "w-96 shrink-0 flex flex-col gap-3 overflow-hidden pt-10 pb-6", children: [accUsage.report && (_jsxs("div", { className: "card p-4 space-y-2 flex-none", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx(Coins, { size: 14, className: "text-text-2" }), _jsx("span", { className: "text-tiny font-semibold uppercase tracking-wide text-text-2", children: "Token usage" }), _jsxs("span", { className: "ml-auto text-small font-semibold text-primary", children: [formatCost(accUsage.report.costUsd + accUsage.extraCost), " total"] })] }), _jsxs("div", { className: "flex justify-between text-small", children: [_jsxs("span", { className: "text-text-2", children: ["Report (", accUsage.report.model, ")"] }), _jsxs("span", { className: "font-mono tabular-nums text-text-2", children: [(accUsage.report.inputTokens + accUsage.report.outputTokens).toLocaleString(), " tok \u00B7 ", formatCost(accUsage.report.costUsd)] })] }), accUsage.extraTokens > 0 && (_jsxs("div", { className: "flex justify-between text-small", children: [_jsx("span", { className: "text-text-2", children: "Chat + translation" }), _jsxs("span", { className: "font-mono tabular-nums text-text-2", children: [accUsage.extraTokens.toLocaleString(), " tok \u00B7 ", formatCost(accUsage.extraCost)] })] }))] })), _jsxs("div", { className: "flex items-center gap-2 flex-none", children: [_jsx(MessageSquare, { size: 15, className: "text-text-2" }), _jsx("h2", { className: "text-small font-semibold text-text", children: "Ask about this content" })] }), _jsxs("div", { className: "card p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto", children: [chatMessages.length === 0 && !chatLoading && (_jsx("p", { className: "text-small text-text-3 text-center mt-8", children: "Ask anything about this session \u2014 Gemini has the full context." })), chatMessages.map((msg) => (_jsx("div", { className: `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`, children: msg.role === 'user' ? (_jsx("div", { className: "max-w-[85%] rounded-xl rounded-tr-sm px-3 py-2 text-small leading-relaxed bg-primary text-white", children: msg.content })) : (_jsx("div", { className: "max-w-[85%] rounded-xl rounded-tl-sm px-3 py-2 text-small bg-surface-2 text-text chat-markdown", 
                                            // eslint-disable-next-line react/no-danger
                                            dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) } })) }, msg.id))), chatLoading && (_jsx("div", { className: "flex justify-start", children: _jsxs("div", { className: "bg-surface-2 rounded-xl rounded-tl-sm px-3 py-2 text-small text-text-2 flex items-center gap-2", children: [_jsx(Loader2, { size: 13, className: "animate-spin" }), "Thinking\u2026"] }) })), _jsx("div", { ref: chatBottomRef })] }), chatError && (_jsx("p", { className: "text-tiny text-red-600 flex-none", children: chatError })), _jsxs("form", { onSubmit: (e) => void handleChatSend(e), className: "flex gap-2 flex-none", children: [_jsx("input", { type: "text", value: chatInput, onChange: (e) => setChatInput(e.target.value), placeholder: "Ask a question\u2026", disabled: chatLoading, className: "input flex-1 text-small" }), _jsx("button", { type: "submit", disabled: !chatInput.trim() || chatLoading, className: "btn-primary px-3 py-2 flex items-center disabled:opacity-50 disabled:cursor-not-allowed", children: _jsx(Send, { size: 14 }) })] })] }))] })] }));
}
//# sourceMappingURL=ReportPage.js.map