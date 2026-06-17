/**
 * Minimal toast notification system
 * Usage: const { addToast } = useToast()
 *        addToast({ title: 'Done', message: '...', action: { label: 'View', onClick } })
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { X, CheckCircle } from 'lucide-react'

interface Toast {
  id: string
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    // Auto-dismiss after 8s (longer if has action)
    const delay = toast.action ? 12_000 : 8_000
    timers.current.set(id, setTimeout(() => removeToast(id), delay))
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Fixed toast stack — bottom-right */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 bg-surface border border-border rounded-xl shadow-lg px-4 py-3 min-w-[280px] max-w-sm animate-in slide-in-from-bottom-2 fade-in duration-200"
          >
            <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-small font-medium text-text">{t.title}</p>
              {t.message && <p className="text-tiny text-text-2 mt-0.5">{t.message}</p>}
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); removeToast(t.id) }}
                  className="mt-1.5 text-tiny font-medium text-primary hover:underline"
                >
                  {t.action.label} →
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-text-3 hover:text-text transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
