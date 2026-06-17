/**
 * Report Page — hiển thị meeting minutes sau khi recording xong
 *
 * Features:
 *   - Render markdown
 *   - Language toggle (EN / FR / VI)
 *   - Export buttons (md / docx / pdf)
 *   - Link back to session list
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Download, Globe, Copy, Check, Send, Loader2, MessageSquare, Printer, ChevronDown, Pencil, Coins } from 'lucide-react'
import { api } from '../api/client.js'
import type { ChatMessage } from '../api/client.js'
import type { Language, SessionCostSummary } from '@transcript/shared'
import { LANGUAGE_LABELS } from '@transcript/shared'

function formatCost(usd: number): string {
  if (usd === 0) return '$0.000'
  if (usd < 0.0001) return '< $0.0001'
  return `$${usd.toFixed(4)}`
}


// Simple markdown renderer — replace with react-markdown in Phase 5 if needed
function renderMarkdown(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1 class="text-title font-bold mt-6 mb-3">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-heading font-semibold mt-5 mb-2 text-text">$2</h2>'.replace('$2', '$1'))
    .replace(/^### (.+)$/gm, '<h3 class="text-body font-semibold mt-4 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-surface-2 px-1 py-0.5 rounded text-small font-mono">$1</code>')
    .replace(/^\| (.+) \|$/gm, (row) => {
      const cells = row.slice(1, -1).split('|').map((c) => c.trim())
      const isSep = cells.every((c) => /^[-:]+$/.test(c))
      if (isSep) return ''
      const tag = 'td'
      return `<tr>${cells.map((c) => `<${tag} class="px-3 py-1.5 border-b border-border text-small">${c}</${tag}>`).join('')}</tr>`
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, (table) =>
      `<div class="overflow-x-auto my-3"><table class="w-full border border-border rounded-md text-left">${table}</table></div>`,
    )
    .replace(/^- (.+)$/gm, '<li class="text-body ml-4 list-disc">$1</li>')
    .replace(/((?:<li.*<\/li>\n?)+)/g, '<ul class="space-y-1 my-2">$1</ul>')
    .replace(/^(?!<[h|u|t|d]|\s*$)(.+)$/gm, '<p class="text-body leading-relaxed my-2">$1</p>')
    .replace(/\n\n+/g, '\n')
}

const TRANSLATE_LANGS: { lang: 'en' | 'fr' | 'vi'; label: string }[] = [
  { lang: 'en', label: 'EN' },
  { lang: 'fr', label: 'FR' },
  { lang: 'vi', label: 'VI' },
]

export default function ReportPage() {
  const { sessionId, reportId } = useParams<{ sessionId: string; reportId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const initialCost = (location.state as { cost?: SessionCostSummary } | null)?.cost ?? null

  // Accumulated LLM usage across report gen + translates + chats
  const [accUsage, setAccUsage] = useState<{
    report: import('@transcript/shared').LLMUsage | null
    extraTokens: number
    extraCost: number
  }>(() => ({
    report: initialCost?.llm ?? null,
    extraTokens: 0,
    extraCost: 0,
  }))

  function addUsage(u: import('@transcript/shared').LLMUsage | undefined) {
    if (!u) return
    setAccUsage((prev) => ({
      ...prev,
      extraTokens: prev.extraTokens + u.inputTokens + u.outputTokens,
      extraCost: prev.extraCost + u.costUsd,
    }))
  }

  const [sessionType, setSessionType] = useState<string | null>(null)
  const [sessionTitle, setSessionTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleEscapeRef = useRef(false)
  const [originalMd, setOriginalMd] = useState('')
  const [displayMd, setDisplayMd] = useState('')
  const [activeLang, setActiveLang] = useState<Language>('en')
  const [translating, setTranslating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!reportId) return
    setLoading(true)
    let cancelled = false

    // Retry up to 8 times with 1.5s delay — server may be restarting after tsx watch
    async function fetchWithRetry(attempts: number): Promise<void> {
      try {
        const data = await api.report.get(reportId!)
        if (cancelled) return
        setOriginalMd(data.content_md)
        setDisplayMd(data.content_md)
      } catch (e) {
        if (cancelled) return
        if (attempts > 0) {
          await new Promise((r) => setTimeout(r, 1500))
          return fetchWithRetry(attempts - 1)
        }
        setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchWithRetry(8)
    return () => { cancelled = true }
  }, [reportId])

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load session type + title
  useEffect(() => {
    if (!sessionId) return
    api.sessions.get(sessionId)
      .then((data) => {
        setSessionType(data.session.type)
        setSessionTitle(data.session.title)
        setTitleValue(data.session.title)
      })
      .catch(() => { /* non-critical */ })
  }, [sessionId])

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  async function commitTitleRename() {
    if (titleEscapeRef.current) { titleEscapeRef.current = false; return }
    const trimmed = titleValue.trim()
    setEditingTitle(false)
    if (!trimmed || trimmed === sessionTitle || !sessionId) return
    const original = sessionTitle
    setSessionTitle(trimmed)
    try {
      await api.sessions.rename(sessionId, trimmed)
    } catch {
      setSessionTitle(original)
    }
  }

  // Load chat history when session loads
  useEffect(() => {
    if (!sessionId) return
    api.chat.history(sessionId)
      .then((msgs) => setChatMessages(msgs))
      .catch(() => { /* ignore — table might be empty */ })
  }, [sessionId])

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault()
    const msg = chatInput.trim()
    if (!msg || !sessionId || chatLoading) return

    // Optimistic update
    const tempUser: ChatMessage = { id: 'tmp-user', role: 'user', content: msg, created_at: new Date().toISOString() }
    setChatMessages((prev) => [...prev, tempUser])
    setChatInput('')
    setChatError(null)
    setChatLoading(true)

    try {
      const result = await api.chat.send(sessionId, msg)
      const tempAssistant: ChatMessage = { id: result.messageId, role: 'assistant', content: result.answer, created_at: new Date().toISOString() }
      setChatMessages((prev) => [...prev.filter((m) => m.id !== 'tmp-user'), tempUser, tempAssistant])
      addUsage(result.llmUsage)
    } catch (err) {
      setChatMessages((prev) => prev.filter((m) => m.id !== 'tmp-user'))
      setChatError(err instanceof Error ? err.message : 'Failed to get a response')
    } finally {
      setChatLoading(false)
    }
  }

  async function handleTranslate(lang: 'en' | 'fr' | 'vi') {
    if (!reportId || (lang as string) === activeLang) return
    if (lang === 'en') {
      setDisplayMd(originalMd)
      setActiveLang('en')
      return
    }

    setTranslating(true)
    try {
      const result = await api.report.translate(reportId, lang)
      setDisplayMd(result.content)
      setActiveLang(lang)
      addUsage(result.llmUsage)
    } catch (e) {
      setError(String(e))
    } finally {
      setTranslating(false)
    }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(displayMd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleExportMd() {
    const blob = new Blob([displayMd], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${sessionId ?? 'export'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportDocx() {
    if (!reportId) return
    // Direct browser download via anchor — no blob needed, server streams the file
    const a = document.createElement('a')
    a.href = api.report.exportDocxUrl(reportId)
    a.download = ''
    a.click()
  }

  function handlePrint() {
    window.print()
  }

  function handleDownloadAudio() {
    if (!sessionId) return
    const a = document.createElement('a')
    a.href = api.sessions.audioUrl(sessionId)
    a.download = ''
    a.click()
  }

  return (
    <main className="h-screen flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface border-b border-border h-14 flex-none flex items-center px-6 gap-4">
        <button
          onClick={() => navigate('/sessions')}
          className="flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors"
        >
          <ArrowLeft size={15} />
          Sessions
        </button>

        <div className="h-4 w-px bg-border" />

        {/* Editable session title */}
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                titleEscapeRef.current = true
                setEditingTitle(false)
                setTitleValue(sessionTitle)
              }
            }}
            onBlur={() => void commitTitleRename()}
            className="input py-1 text-heading font-semibold w-64"
          />
        ) : (
          <button
            onClick={() => { setTitleValue(sessionTitle); setEditingTitle(true) }}
            className="flex items-center gap-1.5 group text-left"
          >
            <h1 className="text-heading font-semibold truncate max-w-xs">
              {sessionTitle || 'Meeting Report'}
            </h1>
            <Pencil size={13} className="text-text-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Language switcher */}
          <div className="flex items-center gap-1 bg-bg border border-border rounded-full p-1">
            <Globe size={13} className="text-text-3 ml-1.5" />
            {TRANSLATE_LANGS.map(({ lang, label }) => (
              <button
                key={lang}
                onClick={() => void handleTranslate(lang)}
                disabled={translating}
                className={`px-3 py-1 rounded-full text-tiny font-medium transition-colors ${
                  activeLang === lang
                    ? 'bg-primary text-white'
                    : 'text-text-2 hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="btn-secondary py-2 px-3 flex items-center gap-1.5 text-small"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          {/* Download audio — live sessions only */}
          {sessionType === 'live' && (
            <button
              onClick={handleDownloadAudio}
              className="btn-secondary py-2 px-3 flex items-center gap-1.5 text-small"
            >
              <Download size={14} />
              Audio
            </button>
          )}

          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="btn-secondary py-2 px-3 flex items-center gap-1.5 text-small"
            >
              <Download size={14} />
              Export
              <ChevronDown size={13} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-md py-1 w-40 z-20">
                <button
                  onClick={() => { handleExportMd(); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-small text-text hover:bg-surface-2 transition-colors"
                >
                  <Download size={13} className="text-text-2" />
                  Markdown (.md)
                </button>
                <button
                  onClick={() => { handleExportDocx(); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-small text-text hover:bg-surface-2 transition-colors"
                >
                  <Download size={13} className="text-text-2" />
                  Word (.docx)
                </button>
                <div className="h-px bg-border mx-2 my-1" />
                <button
                  onClick={() => { handlePrint(); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-small text-text hover:bg-surface-2 transition-colors"
                >
                  <Printer size={13} className="text-text-2" />
                  Print / PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden max-w-7xl mx-auto w-full px-6">

        {/* ── Left: Report ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto py-10">
          {loading && (
            <div className="card flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="card border-red-200 bg-red-50 text-red-700 text-body">{error}</div>
          )}

          {translating && (
            <div className="flex items-center gap-2 text-small text-text-2 mb-4">
              <div className="w-4 h-4 border border-border border-t-primary rounded-full animate-spin" />
              Translating to {LANGUAGE_LABELS[activeLang]}...
            </div>
          )}

          {!loading && !error && (
            <article
              className="card prose-none"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderMarkdown(displayMd) }}
            />
          )}


        </div>

        {/* ── Right: Chat (sticky sidebar) ─────────────────────────── */}
        {!loading && !error && sessionId && (
          <aside className="w-96 shrink-0 flex flex-col gap-3 overflow-hidden pt-10 pb-6">

            {/* Cost summary — updates live as user translates / chats */}
            {accUsage.report && (
              <div className="card p-4 space-y-2 flex-none">
                <div className="flex items-center gap-2 mb-1">
                  <Coins size={14} className="text-text-2" />
                  <span className="text-tiny font-semibold uppercase tracking-wide text-text-2">Token usage</span>
                  <span className="ml-auto text-small font-semibold text-primary">
                    {formatCost(accUsage.report.costUsd + accUsage.extraCost)} total
                  </span>
                </div>
                <div className="flex justify-between text-small">
                  <span className="text-text-2">Report ({accUsage.report.model})</span>
                  <span className="font-mono tabular-nums text-text-2">
                    {(accUsage.report.inputTokens + accUsage.report.outputTokens).toLocaleString()} tok · {formatCost(accUsage.report.costUsd)}
                  </span>
                </div>
                {accUsage.extraTokens > 0 && (
                  <div className="flex justify-between text-small">
                    <span className="text-text-2">Chat + translation</span>
                    <span className="font-mono tabular-nums text-text-2">
                      {accUsage.extraTokens.toLocaleString()} tok · {formatCost(accUsage.extraCost)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-none">
              <MessageSquare size={15} className="text-text-2" />
              <h2 className="text-small font-semibold text-text">Ask about this content</h2>
            </div>

            {/* Message history — fills remaining space */}
            <div className="card p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
              {chatMessages.length === 0 && !chatLoading && (
                <p className="text-small text-text-3 text-center mt-8">
                  Ask anything about this session — Gemini has the full context.
                </p>
              )}

              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] rounded-xl rounded-tr-sm px-3 py-2 text-small leading-relaxed bg-primary text-white">
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      className="max-w-[85%] rounded-xl rounded-tl-sm px-3 py-2 text-small bg-surface-2 text-text chat-markdown"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface-2 rounded-xl rounded-tl-sm px-3 py-2 text-small text-text-2 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {chatError && (
              <p className="text-tiny text-red-600 flex-none">{chatError}</p>
            )}

            <form onSubmit={(e) => void handleChatSend(e)} className="flex gap-2 flex-none">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question…"
                disabled={chatLoading}
                className="input flex-1 text-small"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="btn-primary px-3 py-2 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} />
              </button>
            </form>
          </aside>
        )}
      </div>
    </main>
  )
}
