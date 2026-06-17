import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api/client.js';
import HomePage from './pages/HomePage.js';
import LiveRecordingPage from './pages/LiveRecordingPage.js';
import ReportPage from './pages/ReportPage.js';
import IngestPage from './pages/IngestPage.js';
import SessionsPage from './pages/SessionsPage.js';
import SettingsPage from './pages/SettingsPage.js';
import { ToastProvider } from './components/Toast.js';
const SettingsContext = createContext({
    settings: null,
    setSettings: () => undefined,
});
export function useAppSettings() {
    return useContext(SettingsContext);
}
// ── Setup guard — redirects to /settings?setup=true if Gemini key is missing ──
function RequireSetup({ children }) {
    const { settings } = useAppSettings();
    if (settings !== null && !settings.apiKeys.gemini) {
        return _jsx(Navigate, { to: "/settings?setup=true", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        api.settings.get()
            .then((s) => { setSettings(s); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-bg flex items-center justify-center", children: _jsx("div", { className: "w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" }) }));
    }
    return (_jsx(SettingsContext.Provider, { value: { settings, setSettings }, children: _jsx(ToastProvider, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "/*", element: _jsx(RequireSetup, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/sessions", element: _jsx(SessionsPage, {}) }), _jsx(Route, { path: "/live", element: _jsx(LiveRecordingPage, {}) }), _jsx(Route, { path: "/import/:kind", element: _jsx(IngestPage, {}) }), _jsx(Route, { path: "/session/:sessionId/report/:reportId", element: _jsx(ReportPage, {}) })] }) }) })] }) }) }) }));
}
//# sourceMappingURL=App.js.map