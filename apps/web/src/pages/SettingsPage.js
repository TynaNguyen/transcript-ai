import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Check, AlertCircle, Loader } from 'lucide-react';
import { api } from '../api/client.js';
import { useAppSettings } from '../App.js';
function Section({ title, description, children }) {
    return (_jsxs("div", { className: "card space-y-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-heading font-semibold", children: title }), description && _jsx("p", { className: "text-small text-text-2 mt-1", children: description })] }), children] }));
}
function ApiKeyField({ label, value, onChange, placeholder, hint }) {
    const [visible, setVisible] = useState(false);
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-small font-medium text-text mb-1.5", children: label }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: visible ? 'text' : 'password', value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder ?? 'Paste your API key here', className: "input pr-10 font-mono text-small" }), _jsx("button", { type: "button", onClick: () => setVisible((v) => !v), className: "absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2", tabIndex: -1, children: visible ? _jsx(EyeOff, { size: 15 }) : _jsx(Eye, { size: 15 }) })] }), hint && _jsx("p", { className: "text-tiny text-text-3 mt-1", children: hint })] }));
}
const STT_PROVIDERS = [
    { value: 'assemblyai', label: 'AssemblyAI', description: 'Best for English, real-time streaming, multi-speaker' },
    { value: 'gemini', label: 'Gemini STT', description: 'Best for Vietnamese & multilingual (uses Gemini key)' },
    { value: 'deepgram', label: 'Deepgram', description: 'Nova-3, fast and accurate' },
];
const SOURCE_LANG_OPTIONS = [
    { value: null, label: 'Tự động' },
    { value: 'en', label: 'English' },
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'fr', label: 'Français' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
];
const TRANSLATE_LANG_OPTIONS = [
    { value: null, label: 'Tắt (Off)' },
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
];
export default function SettingsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isSetup = searchParams.get('setup') === 'true';
    const { setSettings: setContextSettings } = useAppSettings();
    const [settings, setSettings] = useState(null);
    const [saveState, setSaveState] = useState('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        api.settings.get()
            .then((s) => { setSettings(s); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);
    function updateApiKey(provider, value) {
        setSettings((prev) => prev ? { ...prev, apiKeys: { ...prev.apiKeys, [provider]: value } } : prev);
    }
    function updateSttProvider(provider) {
        setSettings((prev) => (prev ? { ...prev, sttProvider: provider } : prev));
    }
    function updateLiveRecording(key, value) {
        setSettings((prev) => prev ? { ...prev, liveRecording: { ...prev.liveRecording, [key]: value } } : prev);
    }
    async function handleSave() {
        if (!settings)
            return;
        setSaveState('saving');
        setErrorMsg('');
        try {
            const saved = await api.settings.update(settings);
            setContextSettings(saved);
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
            if (isSetup)
                navigate('/');
        }
        catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings');
            setSaveState('error');
        }
    }
    if (loading) {
        return (_jsx("main", { className: "min-h-screen bg-bg flex items-center justify-center", children: _jsx(Loader, { size: 24, className: "animate-spin text-text-3" }) }));
    }
    if (!settings) {
        return (_jsx("main", { className: "min-h-screen bg-bg flex items-center justify-center", children: _jsx("p", { className: "text-text-2", children: "Failed to load settings. Is the server running?" }) }));
    }
    return (_jsxs("main", { className: "min-h-screen bg-bg", children: [_jsxs("header", { className: "sticky top-0 z-10 bg-surface border-b border-border h-14 flex items-center px-6 gap-4", children: [!isSetup && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => navigate('/'), className: "flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors", children: [_jsx(ArrowLeft, { size: 15 }), "Back"] }), _jsx("div", { className: "h-4 w-px bg-border" })] })), _jsx("h1", { className: "text-heading", children: isSetup ? 'Welcome — Set up your API keys' : 'Settings' })] }), _jsxs("div", { className: "max-w-content mx-auto px-6 py-10 space-y-6", children: [isSetup && (_jsx("div", { className: "card border-amber-200 bg-amber-50", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(AlertCircle, { size: 18, className: "text-amber-600 shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "text-body font-medium text-amber-800", children: "API keys required" }), _jsx("p", { className: "text-small text-amber-700 mt-1", children: "This app uses your own API keys \u2014 your data stays on your machine and never goes to our servers. Add your Gemini key below to get started." })] })] }) })), _jsxs(Section, { title: "\uD83D\uDD11 API Keys", description: "Stored locally on this machine. Sent only to the respective AI providers when you use the app.", children: [_jsx(ApiKeyField, { label: "Google Gemini API Key (required)", value: settings.apiKeys.gemini, onChange: (v) => updateApiKey('gemini', v), hint: "Used for report generation, chat, and (optionally) STT. Get yours at aistudio.google.com/apikey" }), _jsxs("div", { className: "border-t border-border pt-4 space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-small font-medium text-text mb-3", children: "STT Provider" }), _jsx("div", { className: "space-y-2", children: STT_PROVIDERS.map((p) => (_jsxs("label", { className: `flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${settings.sttProvider === p.value
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border hover:border-border-2'}`, children: [_jsx("input", { type: "radio", name: "sttProvider", value: p.value, checked: settings.sttProvider === p.value, onChange: () => updateSttProvider(p.value), className: "mt-0.5 accent-primary" }), _jsxs("div", { children: [_jsx("span", { className: "text-small font-medium", children: p.label }), _jsx("p", { className: "text-tiny text-text-3 mt-0.5", children: p.description })] })] }, p.value))) })] }), settings.sttProvider === 'assemblyai' && (_jsx(ApiKeyField, { label: "AssemblyAI API Key", value: settings.apiKeys.assemblyai, onChange: (v) => updateApiKey('assemblyai', v), hint: "assemblyai.com \u2192 Dashboard \u2192 API Keys" })), settings.sttProvider === 'deepgram' && (_jsx(ApiKeyField, { label: "Deepgram API Key", value: settings.apiKeys.deepgram, onChange: (v) => updateApiKey('deepgram', v), hint: "console.deepgram.com \u2192 API Keys" })), settings.sttProvider === 'gemini' && (_jsx("p", { className: "text-tiny text-text-3 bg-surface rounded-md p-3 border border-border", children: "Gemini STT uses the Gemini API key above." }))] })] }), _jsxs(Section, { title: "\uD83C\uDF99 Live Recording Defaults", description: "Pre-selected languages when you open the Live Recording page. You can still change them per session.", children: [_jsxs("div", { children: [_jsx("p", { className: "text-small font-medium text-text mb-2", children: "Ng\u00F4n ng\u1EEF n\u00F3i m\u1EB7c \u0111\u1ECBnh (input language)" }), _jsx("div", { className: "flex gap-2 flex-wrap", children: SOURCE_LANG_OPTIONS.map((opt) => (_jsx("button", { onClick: () => updateLiveRecording('defaultSourceLang', opt.value), className: `px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${settings.liveRecording.defaultSourceLang === opt.value
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border text-text-2 hover:text-text hover:border-border-2'}`, children: opt.label }, opt.value ?? 'auto'))) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-small font-medium text-text mb-2", children: "Ng\u00F4n ng\u1EEF d\u1ECBch m\u1EB7c \u0111\u1ECBnh (translate to)" }), _jsx("div", { className: "flex gap-2 flex-wrap", children: TRANSLATE_LANG_OPTIONS.map((opt) => (_jsx("button", { onClick: () => updateLiveRecording('defaultTranslateLang', opt.value), className: `px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${settings.liveRecording.defaultTranslateLang === opt.value
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border text-text-2 hover:text-text hover:border-border-2'}`, children: opt.label }, opt.value ?? 'off'))) })] })] }), saveState === 'error' && (_jsxs("div", { className: "flex items-center gap-2 text-red-600 text-small", children: [_jsx(AlertCircle, { size: 15 }), errorMsg] })), _jsx("button", { onClick: () => void handleSave(), disabled: saveState === 'saving', className: "btn-primary flex items-center justify-center gap-2 w-full py-3", children: saveState === 'saving' ? (_jsx(Loader, { size: 16, className: "animate-spin" })) : saveState === 'saved' ? (_jsxs(_Fragment, { children: [_jsx(Check, { size: 16 }), " Saved!"] })) : isSetup ? ('Save & Continue') : ('Save Settings') })] })] }));
}
//# sourceMappingURL=SettingsPage.js.map