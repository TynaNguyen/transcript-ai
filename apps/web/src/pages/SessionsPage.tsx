/**
 * Sessions Page — danh sách tất cả sessions
 * Features: search, pagination, multi-select bulk delete, inline rename
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic, Youtube, FileText, Globe, Video, Headphones,
  ArrowRight, Trash2, Plus, Loader2, AlertCircle,
  Search, X, Check, ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react'
import { api } from '../api/client.js'
import type { SourceKind } from '@transcript/shared'

interface SessionRow {
  id: string
  type: SourceKind
  title: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  created_at: string
  reports: { id: string; template: string; created_at: string }[]
}

const KIND_ICON: Record<SourceKind, React.ReactNode> = {
  live:    <Mic size={15} />,
  youtube: <Youtube size={15} />,
  pdf:     <FileText size={15} />,
  web:     <Globe size={15} />,
  video:   <Video size={15} />,
  audio:   <Headphones size={15} />,
}

const KIND_LABEL: Record<SourceKind, string> = {
  live: 'Live', youtube: 'YouTube', pdf: 'PDF',
  web: 'Website', video: 'Video', audio: 'Audio',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SkeletonRow() {
  return (
    <li className="card flex items-center gap-4 animate-pulse">
      <div className="w-5 h-5 rounded bg-surface-2 shrink-0" />
      <div className="w-8 h-8 rounded-md bg-surface-2 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-2/3 bg-surface-2 rounded" />
        <div className="h-3 w-1/4 bg-surface-2 rounded" />
      </div>
      <div className="w-6 h-6 bg-surface-2 rounded" />
    </li>
  )
}

const PAGE_SIZE = 10

export default function SessionsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search
  const [query, setQuery] = useState('')

  // Pagination
  const [page, setPage] = useState(1)

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Per-row deleting
  const [deleting, setDeleting] = useState<string | null>(null)

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const renameEscapeRef = useRef(false)

  useEffect(() => {
    api.sessions.list()
      .then((data) => setSessions(data as SessionRow[]))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  // Reset page when search changes
  useEffect(() => { setPage(1) }, [query])

  // Derived: filtered + paginated
  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase()),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Select helpers
  const allPageSelected = paginated.length > 0 && paginated.every((s) => selected.has(s.id))
  const someSelected = selected.size > 0

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        paginated.forEach((s) => next.delete(s.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        paginated.forEach((s) => next.add(s.id))
        return next
      })
    }
  }

  // Rename
  function startRename(session: SessionRow, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(session.id)
    setRenameValue(session.title)
  }

  async function commitRename(id: string) {
    if (renameEscapeRef.current) { renameEscapeRef.current = false; return }
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed) return
    // Capture original BEFORE optimistic update (no stale closure)
    const original = sessions.find((s) => s.id === id)?.title ?? trimmed
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: trimmed } : s))
    try {
      await api.sessions.rename(id, trimmed)
    } catch {
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: original } : s))
    }
  }

  // Single delete
  async function handleDelete(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation()
    if (!confirm('Delete this session?')) return
    setDeleting(sessionId)
    try {
      await api.sessions.delete(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setSelected((prev) => { const n = new Set(prev); n.delete(sessionId); return n })
    } catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  // Bulk delete
  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} session${selected.size > 1 ? 's' : ''}?`)) return
    setBulkDeleting(true)
    const ids = [...selected]
    try {
      await api.sessions.bulkDelete(ids)
      setSessions((prev) => prev.filter((s) => !ids.includes(s.id)))
      setSelected(new Set())
    } catch { /* ignore partial failure */ }
    finally { setBulkDeleting(false) }
  }

  function handleOpen(session: SessionRow) {
    if (renamingId) return
    const report = session.reports?.[0]
    if (report && session.status === 'ready') {
      navigate(`/session/${session.id}/report/${report.id}`)
    }
  }

  return (
    <main className="min-h-screen bg-bg">
      <header className="bg-surface border-b border-border h-14 flex items-center px-6 gap-4 sticky top-0 z-10">
        <h1 className="text-heading font-semibold">Sessions</h1>
        <div className="ml-auto">
          <button
            onClick={() => navigate('/')}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-small"
          >
            <Plus size={15} />
            New session
          </button>
        </div>
      </header>

      <div className="max-w-content mx-auto px-6 py-8 space-y-4">

        {/* Search + bulk action bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions…"
              className="input pl-9 pr-8 py-2 text-small"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {someSelected && (
            <button
              onClick={() => void handleBulkDelete()}
              disabled={bulkDeleting}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100
                         transition-colors text-small font-medium px-4 py-2 rounded-md disabled:opacity-50"
            >
              {bulkDeleting
                ? <Loader2 size={14} className="animate-spin" />
                : <Trash2 size={14} />}
              Delete {selected.size}
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <ul className="space-y-2">
            <SkeletonRow /><SkeletonRow /><SkeletonRow />
          </ul>
        )}

        {/* Error */}
        {error && (
          <div className="card border-red-200 bg-red-50 flex items-start gap-2 text-red-700 text-body">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-24 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
              <Mic size={28} className="text-text-3" />
            </div>
            <div>
              <p className="text-heading font-semibold text-text">No sessions yet</p>
              <p className="text-small text-text-2 mt-1">Import a YouTube video, PDF, or start a live recording.</p>
            </div>
            <button onClick={() => navigate('/')} className="btn-primary flex items-center gap-2 py-2 px-4 text-small">
              <Plus size={15} />
              Create your first session
            </button>
          </div>
        )}

        {/* No search results */}
        {!loading && !error && sessions.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16 text-text-2 text-small">
            No sessions match "<span className="font-medium text-text">{query}</span>"
          </div>
        )}

        {/* Session list */}
        {!loading && filtered.length > 0 && (
          <>
            {/* Select-all row */}
            <div className="flex items-center gap-3 px-1">
              <button
                onClick={toggleSelectAll}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                  ${allPageSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/60'}`}
              >
                {allPageSelected && <Check size={11} className="text-white" />}
              </button>
              <span className="text-tiny text-text-3">
                {someSelected ? `${selected.size} selected` : `${filtered.length} session${filtered.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            <ul className="space-y-2">
              {paginated.map((session) => {
                const hasReport = session.reports?.length > 0
                const isClickable = hasReport && session.status === 'ready'
                const isSelected = selected.has(session.id)
                const isRenaming = renamingId === session.id

                return (
                  <li
                    key={session.id}
                    onClick={() => isClickable && handleOpen(session)}
                    className={`card flex items-center gap-4 transition-colors
                      ${isClickable && !isRenaming ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : ''}
                      ${isSelected ? 'border-primary/40 bg-primary/5' : ''}
                      ${!isClickable && !isSelected ? 'opacity-60' : ''}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(session.id) }}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                        ${isSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/60'}`}
                    >
                      {isSelected && <Check size={11} className="text-white" />}
                    </button>

                    {/* Kind icon */}
                    <div className="w-8 h-8 rounded-md bg-surface-2 flex items-center justify-center text-text-2 shrink-0">
                      {KIND_ICON[session.type]}
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') {
                              renameEscapeRef.current = true
                              setRenamingId(null)
                            }
                          }}
                          onBlur={() => void commitRename(session.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="input py-1 text-body w-full max-w-sm"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <p className="text-body font-medium text-text truncate">{session.title}</p>
                          <button
                            onClick={(e) => startRename(session, e)}
                            className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-text-2 transition-opacity shrink-0"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="tag-default">{KIND_LABEL[session.type]}</span>
                        <span className="text-tiny text-text-3">{formatDate(session.created_at)}</span>
                        {session.status === 'processing' && (
                          <span className="text-tiny text-accent flex items-center gap-1">
                            <Loader2 size={11} className="animate-spin" />Processing…
                          </span>
                        )}
                        {session.status === 'error' && (
                          <span className="text-tiny text-red-500">Failed</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => void handleDelete(e, session.id)}
                        disabled={deleting === session.id}
                        className="p-1.5 rounded-md text-text-3 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {deleting === session.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                      {isClickable && <ArrowRight size={15} className="text-text-3" />}
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md border border-border text-text-2 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-md text-small font-medium transition-colors
                        ${p === page ? 'bg-primary text-white' : 'text-text-2 hover:bg-surface-2'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md border border-border text-text-2 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
