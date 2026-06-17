import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Minimal toast notification system
 * Usage: const { addToast } = useToast()
 *        addToast({ title: 'Done', message: '...', action: { label: 'View', onClick } })
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle } from 'lucide-react';
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);
    const addToast = useCallback((toast) => {
        const id = Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev, { ...toast, id }]);
        // Auto-dismiss after 8s (longer if has action)
        const delay = toast.action ? 12_000 : 8_000;
        timers.current.set(id, setTimeout(() => removeToast(id), delay));
    }, [removeToast]);
    return (_jsxs(ToastContext.Provider, { value: { addToast }, children: [children, _jsx("div", { className: "fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none", children: toasts.map((t) => (_jsxs("div", { className: "pointer-events-auto flex items-start gap-3 bg-surface border border-border rounded-xl shadow-lg px-4 py-3 min-w-[280px] max-w-sm animate-in slide-in-from-bottom-2 fade-in duration-200", children: [_jsx(CheckCircle, { size: 16, className: "text-green-500 shrink-0 mt-0.5" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-small font-medium text-text", children: t.title }), t.message && _jsx("p", { className: "text-tiny text-text-2 mt-0.5", children: t.message }), t.action && (_jsxs("button", { onClick: () => { t.action.onClick(); removeToast(t.id); }, className: "mt-1.5 text-tiny font-medium text-primary hover:underline", children: [t.action.label, " \u2192"] }))] }), _jsx("button", { onClick: () => removeToast(t.id), className: "text-text-3 hover:text-text transition-colors shrink-0", children: _jsx(X, { size: 14 }) })] }, t.id))) })] }));
}
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx)
        throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
//# sourceMappingURL=Toast.js.map