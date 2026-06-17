import { createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { AppSettings } from '@transcript/shared'
import { api } from './api/client.js'
import HomePage from './pages/HomePage.js'
import LiveRecordingPage from './pages/LiveRecordingPage.js'
import ReportPage from './pages/ReportPage.js'
import IngestPage from './pages/IngestPage.js'
import SessionsPage from './pages/SessionsPage.js'
import SettingsPage from './pages/SettingsPage.js'
import CompactRecordingPage from './pages/CompactRecordingPage.js'
import { ToastProvider } from './components/Toast.js'

// ── Settings context ───────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: AppSettings | null
  setSettings: (s: AppSettings) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  setSettings: () => undefined,
})

export function useAppSettings(): SettingsContextValue {
  return useContext(SettingsContext)
}

// ── Setup guard — redirects to /settings?setup=true if Gemini key is missing ──

function RequireSetup({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings()
  if (settings !== null && !settings.apiKeys.gemini) {
    return <Navigate to="/settings?setup=true" replace />
  }
  return <>{children}</>
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.settings.get()
      .then((s) => { setSettings(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/live-compact" element={<CompactRecordingPage />} />
            <Route
              path="/*"
              element={
                <RequireSetup>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/sessions" element={<SessionsPage />} />
                    <Route path="/live" element={<LiveRecordingPage />} />
                    <Route path="/import/:kind" element={<IngestPage />} />
                    <Route path="/session/:sessionId/report/:reportId" element={<ReportPage />} />
                  </Routes>
                </RequireSetup>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SettingsContext.Provider>
  )
}
