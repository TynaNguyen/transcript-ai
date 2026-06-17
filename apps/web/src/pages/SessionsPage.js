import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Sessions Page — danh sách tất cả sessions
 * Features: search, pagination, multi-select bulk delete, inline rename
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Youtube, FileText, Globe, Video, Headphones, ArrowRight, Trash2, Plus, Loader2, AlertCircle, Search, X, Check, ChevronLeft, ChevronRight, Pencil, } from 'lucide-react';
import { api } from '../api/client.js';
const KIND_ICON = {
    live: _jsx(Mic, { size: 15 }),
    youtube: _jsx(Youtube, { size: 15 }),
    pdf: _jsx(FileText, { size: 15 }),
    web: _jsx(Globe, { size: 15 }),
    video: _jsx(Video, { size: 15 }),
    audio: _jsx(Headphones, { size: 15 }),
};
const KIND_LABEL = {
    live: 'Live', youtube: 'YouTube', pdf: 'PDF',
    web: 'Website', video: 'Video', audio: 'Audio',
};
function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000);
    if (diffMin < 1)
        return 'Just now';
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)
        return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7)
        return `${diffD}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function SkeletonRow() {
    return (_jsxs("li", { className: "card flex items-center gap-4 animate-pulse", children: [_jsx("div", { className: "w-5 h-5 rounded bg-surface-2 shrink-0" }), _jsx("div", { className: "w-8 h-8 rounded-md bg-surface-2 shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0 space-y-1.5", children: [_jsx("div", { className: "h-4 w-2/3 bg-surface-2 rounded" }), _jsx("div", { className: "h-3 w-1/4 bg-surface-2 rounded" })] }), _jsx("div", { className: "w-6 h-6 bg-surface-2 rounded" })] }));
}
const PAGE_SIZE = 10;
export default function SessionsPage() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Search
    const [query, setQuery] = useState('');
    // Pagination
    const [page, setPage] = useState(1);
    // Selection
    const [selected, setSelected] = useState(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    // Per-row deleting
    const [deleting, setDeleting] = useState(null);
    // Inline rename
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef(null);
    const renameEscapeRef = useRef(false);
    useEffect(() => {
        api.sessions.list()
            .then((data) => setSessions(data))
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);
    // Reset page when search changes
    useEffect(() => { setPage(1); }, [query]);
    // Derived: filtered + paginated
    const filtered = sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    // Select helpers
    const allPageSelected = paginated.length > 0 && paginated.every((s) => selected.has(s.id));
    const someSelected = selected.size > 0;
    function toggleSelect(id) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }
    function toggleSelectAll() {
        if (allPageSelected) {
            setSelected((prev) => {
                const next = new Set(prev);
                paginated.forEach((s) => next.delete(s.id));
                return next;
            });
        }
        else {
            setSelected((prev) => {
                const next = new Set(prev);
                paginated.forEach((s) => next.add(s.id));
                return next;
            });
        }
    }
    // Rename
    function startRename(session, e) {
        e.stopPropagation();
        setRenamingId(session.id);
        setRenameValue(session.title);
    }
    async function commitRename(id) {
        if (renameEscapeRef.current) {
            renameEscapeRef.current = false;
            return;
        }
        const trimmed = renameValue.trim();
        setRenamingId(null);
        if (!trimmed)
            return;
        // Capture original BEFORE optimistic update (no stale closure)
        const original = sessions.find((s) => s.id === id)?.title ?? trimmed;
        setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: trimmed } : s));
        try {
            await api.sessions.rename(id, trimmed);
        }
        catch {
            setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: original } : s));
        }
    }
    // Single delete
    async function handleDelete(e, sessionId) {
        e.stopPropagation();
        if (!confirm('Delete this session?'))
            return;
        setDeleting(sessionId);
        try {
            await api.sessions.delete(sessionId);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            setSelected((prev) => { const n = new Set(prev); n.delete(sessionId); return n; });
        }
        catch { /* ignore */ }
        finally {
            setDeleting(null);
        }
    }
    // Bulk delete
    async function handleBulkDelete() {
        if (!confirm(`Delete ${selected.size} session${selected.size > 1 ? 's' : ''}?`))
            return;
        setBulkDeleting(true);
        const ids = [...selected];
        try {
            await api.sessions.bulkDelete(ids);
            setSessions((prev) => prev.filter((s) => !ids.includes(s.id)));
            setSelected(new Set());
        }
        catch { /* ignore partial failure */ }
        finally {
            setBulkDeleting(false);
        }
    }
    function handleOpen(session) {
        if (renamingId)
            return;
        const report = session.reports?.[0];
        if (report && session.status === 'ready') {
            navigate(`/session/${session.id}/report/${report.id}`);
        }
    }
    return (_jsxs("main", { className: "min-h-screen bg-bg", children: [_jsxs("header", { className: "bg-surface border-b border-border h-14 flex items-center px-6 gap-4 sticky top-0 z-10", children: [_jsx("h1", { className: "text-heading font-semibold", children: "Sessions" }), _jsx("div", { className: "ml-auto", children: _jsxs("button", { onClick: () => navigate('/'), className: "btn-primary flex items-center gap-2 py-2 px-4 text-small", children: [_jsx(Plus, { size: 15 }), "New session"] }) })] }), _jsxs("div", { className: "max-w-content mx-auto px-6 py-8 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none" }), _jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search sessions\u2026", className: "input pl-9 pr-8 py-2 text-small" }), query && (_jsx("button", { onClick: () => setQuery(''), className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text transition-colors", children: _jsx(X, { size: 14 }) }))] }), someSelected && (_jsxs("button", { onClick: () => void handleBulkDelete(), disabled: bulkDeleting, className: "flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100\n                         transition-colors text-small font-medium px-4 py-2 rounded-md disabled:opacity-50", children: [bulkDeleting
                                        ? _jsx(Loader2, { size: 14, className: "animate-spin" })
                                        : _jsx(Trash2, { size: 14 }), "Delete ", selected.size] }))] }), loading && (_jsxs("ul", { className: "space-y-2", children: [_jsx(SkeletonRow, {}), _jsx(SkeletonRow, {}), _jsx(SkeletonRow, {})] })), error && (_jsxs("div", { className: "card border-red-200 bg-red-50 flex items-start gap-2 text-red-700 text-body", children: [_jsx(AlertCircle, { size: 16, className: "shrink-0 mt-0.5" }), _jsx("span", { children: error })] })), !loading && !error && sessions.length === 0 && (_jsxs("div", { className: "text-center py-24 flex flex-col items-center gap-4", children: [_jsx("div", { className: "w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center", children: _jsx(Mic, { size: 28, className: "text-text-3" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-heading font-semibold text-text", children: "No sessions yet" }), _jsx("p", { className: "text-small text-text-2 mt-1", children: "Import a YouTube video, PDF, or start a live recording." })] }), _jsxs("button", { onClick: () => navigate('/'), className: "btn-primary flex items-center gap-2 py-2 px-4 text-small", children: [_jsx(Plus, { size: 15 }), "Create your first session"] })] })), !loading && !error && sessions.length > 0 && filtered.length === 0 && (_jsxs("div", { className: "text-center py-16 text-text-2 text-small", children: ["No sessions match \"", _jsx("span", { className: "font-medium text-text", children: query }), "\""] })), !loading && filtered.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-3 px-1", children: [_jsx("button", { onClick: toggleSelectAll, className: `w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                  ${allPageSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/60'}`, children: allPageSelected && _jsx(Check, { size: 11, className: "text-white" }) }), _jsx("span", { className: "text-tiny text-text-3", children: someSelected ? `${selected.size} selected` : `${filtered.length} session${filtered.length !== 1 ? 's' : ''}` })] }), _jsx("ul", { className: "space-y-2", children: paginated.map((session) => {
                                    const hasReport = session.reports?.length > 0;
                                    const isClickable = hasReport && session.status === 'ready';
                                    const isSelected = selected.has(session.id);
                                    const isRenaming = renamingId === session.id;
                                    return (_jsxs("li", { onClick: () => isClickable && handleOpen(session), className: `card flex items-center gap-4 transition-colors
                      ${isClickable && !isRenaming ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : ''}
                      ${isSelected ? 'border-primary/40 bg-primary/5' : ''}
                      ${!isClickable && !isSelected ? 'opacity-60' : ''}`, children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); toggleSelect(session.id); }, className: `w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                        ${isSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/60'}`, children: isSelected && _jsx(Check, { size: 11, className: "text-white" }) }), _jsx("div", { className: "w-8 h-8 rounded-md bg-surface-2 flex items-center justify-center text-text-2 shrink-0", children: KIND_ICON[session.type] }), _jsxs("div", { className: "flex-1 min-w-0", children: [isRenaming ? (_jsx("input", { ref: renameInputRef, value: renameValue, onChange: (e) => setRenameValue(e.target.value), onKeyDown: (e) => {
                                                            if (e.key === 'Enter')
                                                                e.currentTarget.blur();
                                                            if (e.key === 'Escape') {
                                                                renameEscapeRef.current = true;
                                                                setRenamingId(null);
                                                            }
                                                        }, onBlur: () => void commitRename(session.id), onClick: (e) => e.stopPropagation(), className: "input py-1 text-body w-full max-w-sm" })) : (_jsxs("div", { className: "flex items-center gap-1.5 group", children: [_jsx("p", { className: "text-body font-medium text-text truncate", children: session.title }), _jsx("button", { onClick: (e) => startRename(session, e), className: "opacity-0 group-hover:opacity-100 text-text-3 hover:text-text-2 transition-opacity shrink-0", children: _jsx(Pencil, { size: 12 }) })] })), _jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [_jsx("span", { className: "tag-default", children: KIND_LABEL[session.type] }), _jsx("span", { className: "text-tiny text-text-3", children: formatDate(session.created_at) }), session.status === 'processing' && (_jsxs("span", { className: "text-tiny text-accent flex items-center gap-1", children: [_jsx(Loader2, { size: 11, className: "animate-spin" }), "Processing\u2026"] })), session.status === 'error' && (_jsx("span", { className: "text-tiny text-red-500", children: "Failed" }))] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("button", { onClick: (e) => void handleDelete(e, session.id), disabled: deleting === session.id, className: "p-1.5 rounded-md text-text-3 hover:text-red-500 hover:bg-red-50 transition-colors", children: deleting === session.id
                                                            ? _jsx(Loader2, { size: 14, className: "animate-spin" })
                                                            : _jsx(Trash2, { size: 14 }) }), isClickable && _jsx(ArrowRight, { size: 15, className: "text-text-3" })] })] }, session.id));
                                }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, className: "p-1.5 rounded-md border border-border text-text-2 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { size: 15 }) }), _jsx("div", { className: "flex items-center gap-1", children: Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (_jsx("button", { onClick: () => setPage(p), className: `w-8 h-8 rounded-md text-small font-medium transition-colors
                        ${p === page ? 'bg-primary text-white' : 'text-text-2 hover:bg-surface-2'}`, children: p }, p))) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-1.5 rounded-md border border-border text-text-2 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { size: 15 }) })] }))] }))] })] }));
}
//# sourceMappingURL=SessionsPage.js.map