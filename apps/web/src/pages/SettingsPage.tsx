import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Check, AlertCircle, Loader } from 'lucide-react'
import type { AppSettings, SttProvider } from '@transcript/shared'
import { api } from '../api/client.js'
import { useAppSettings } from '../App.js'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

function Section({ title, description, children }: SectionProps) {
  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-heading font-semibold">{title}</h2>
        {description && <p className="text-small text-text-2 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  )
}

interface ApiKeyFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}

function ApiKeyField({ label, value, onChange, placeholder, hint }: ApiKeyFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="block text-small font-medium text-text mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Paste your API key here'}
          className="input pr-10 font-mono text-small"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2"
          tabIndex={-1}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && <p className="text-tiny text-text-3 mt-1">{hint}</p>}
    </div>
  )
}

const STT_PROVIDERS: { value: SttProvider; label: string; description: string }[] = [
  { value: 'assemblyai', label: 'AssemblyAI', description: 'Best for English, real-time streaming, multi-speaker' },
  { value: 'gemini',     label: 'Gemini STT', description: 'Best for Vietnamese & multilingual (uses Gemini key)' },
  { value: 'deepgram',   label: 'Deepgram',   description: 'Nova-3, fast and accurate' },
]

const SOURCE_LANG_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: 'Tự động' },
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'fr', label: 'Français' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

const TRANSLATE_LANG_OPTIONS: { value: 'en' | 'fr' | 'vi' | null; label: string }[] = [
  { value: null, label: 'Tắt (Off)' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSetup = searchParams.get('setup') === 'true'
  const { setSettings: setContextSettings } = useAppSettings()

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.settings.get()
      .then((s) => { setSettings(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function updateApiKey(provider: keyof AppSettings['apiKeys'], value: string) {
    setSettings((prev) =>
      prev ? { ...prev, apiKeys: { ...prev.apiKeys, [provider]: value } } : prev,
    )
  }

  function updateSttProvider(provider: SttProvider) {
    setSettings((prev) => (prev ? { ...prev, sttProvider: provider } : prev))
  }

  function updateLiveRecording(
    key: keyof AppSettings['liveRecording'],
    value: string | null,
  ) {
    setSettings((prev) =>
      prev ? { ...prev, liveRecording: { ...prev.liveRecording, [key]: value } } : prev,
    )
  }

  async function handleSave() {
    if (!settings) return
    setSaveState('saving')
    setErrorMsg('')
    try {
      const saved = await api.settings.update(settings)
      setContextSettings(saved)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
      if (isSetup) navigate('/')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings')
      setSaveState('error')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <Loader size={24} className="animate-spin text-text-3" />
      </main>
    )
  }

  if (!settings) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-text-2">Failed to load settings. Is the server running?</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-surface border-b border-border h-14 flex items-center px-6 gap-4">
        {!isSetup && (
          <>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors"
            >
              <ArrowLeft size={15} />
              Back
            </button>
            <div className="h-4 w-px bg-border" />
          </>
        )}
        <h1 className="text-heading">
          {isSetup ? 'Welcome — Set up your API keys' : 'Settings'}
        </h1>
      </header>

      <div className="max-w-content mx-auto px-6 py-10 space-y-6">

        {/* Setup notice */}
        {isSetup && (
          <div className="card border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-body font-medium text-amber-800">API keys required</p>
                <p className="text-small text-amber-700 mt-1">
                  This app uses your own API keys — your data stays on your machine and never
                  goes to our servers. Add your Gemini key below to get started.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Category 1: API Keys ── */}
        <Section
          title="🔑 API Keys"
          description="Stored locally on this machine. Sent only to the respective AI providers when you use the app."
        >
          <ApiKeyField
            label="Google Gemini API Key (required)"
            value={settings.apiKeys.gemini}
            onChange={(v) => updateApiKey('gemini', v)}
            hint="Used for report generation, chat, and (optionally) STT. Get yours at aistudio.google.com/apikey"
          />

          <div className="border-t border-border pt-4 space-y-4">
            <div>
              <p className="text-small font-medium text-text mb-3">STT Provider</p>
              <div className="space-y-2">
                {STT_PROVIDERS.map((p) => (
                  <label
                    key={p.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      settings.sttProvider === p.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border-2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sttProvider"
                      value={p.value}
                      checked={settings.sttProvider === p.value}
                      onChange={() => updateSttProvider(p.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="text-small font-medium">{p.label}</span>
                      <p className="text-tiny text-text-3 mt-0.5">{p.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {settings.sttProvider === 'assemblyai' && (
              <ApiKeyField
                label="AssemblyAI API Key"
                value={settings.apiKeys.assemblyai}
                onChange={(v) => updateApiKey('assemblyai', v)}
                hint="assemblyai.com → Dashboard → API Keys"
              />
            )}

            {settings.sttProvider === 'deepgram' && (
              <ApiKeyField
                label="Deepgram API Key"
                value={settings.apiKeys.deepgram}
                onChange={(v) => updateApiKey('deepgram', v)}
                hint="console.deepgram.com → API Keys"
              />
            )}

            {settings.sttProvider === 'gemini' && (
              <p className="text-tiny text-text-3 bg-surface rounded-md p-3 border border-border">
                Gemini STT uses the Gemini API key above.
              </p>
            )}
          </div>
        </Section>

        {/* ── Category 2: Live Recording Defaults ── */}
        <Section
          title="🎙 Live Recording Defaults"
          description="Pre-selected languages when you open the Live Recording page. You can still change them per session."
        >
          <div>
            <p className="text-small font-medium text-text mb-2">Ngôn ngữ nói mặc định (input language)</p>
            <div className="flex gap-2 flex-wrap">
              {SOURCE_LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value ?? 'auto'}
                  onClick={() => updateLiveRecording('defaultSourceLang', opt.value)}
                  className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${
                    settings.liveRecording.defaultSourceLang === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-text-2 hover:text-text hover:border-border-2'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-small font-medium text-text mb-2">Ngôn ngữ dịch mặc định (translate to)</p>
            <div className="flex gap-2 flex-wrap">
              {TRANSLATE_LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value ?? 'off'}
                  onClick={() => updateLiveRecording('defaultTranslateLang', opt.value)}
                  className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${
                    settings.liveRecording.defaultTranslateLang === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-text-2 hover:text-text hover:border-border-2'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {saveState === 'error' && (
          <div className="flex items-center gap-2 text-red-600 text-small">
            <AlertCircle size={15} />
            {errorMsg}
          </div>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={saveState === 'saving'}
          className="btn-primary flex items-center justify-center gap-2 w-full py-3"
        >
          {saveState === 'saving' ? (
            <Loader size={16} className="animate-spin" />
          ) : saveState === 'saved' ? (
            <><Check size={16} /> Saved!</>
          ) : isSetup ? (
            'Save & Continue'
          ) : (
            'Save Settings'
          )}
        </button>

      </div>
    </main>
  )
}
