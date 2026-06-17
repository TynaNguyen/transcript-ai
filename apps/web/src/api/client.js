/**
 * API client — chỉ gọi backend của mình
 * KHÔNG gọi Gemini/STT/Supabase trực tiếp từ frontend
 */
import { config } from '../config.js';
async function apiFetch(path, init) {
    const res = await fetch(`${config.apiUrl}${path}`, {
        headers: { 'Content-Type': 'application/json', ...init?.headers },
        ...init,
    });
    const json = (await res.json());
    if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    return json.data;
}
/** Multipart form upload — không set Content-Type (browser tự thêm boundary) */
async function apiUpload(path, formData) {
    const res = await fetch(`${config.apiUrl}${path}`, {
        method: 'POST',
        body: formData,
    });
    // Guard against non-JSON responses (e.g. 404 HTML page if server not running)
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        throw new Error(`Server error ${res.status} — is the backend running?`);
    }
    const json = (await res.json());
    if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    return json.data;
}
export const api = {
    settings: {
        get: () => apiFetch('/api/settings'),
        update: (patch) => apiFetch('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(patch),
        }),
    },
    sessions: {
        list: () => apiFetch('/api/sessions'),
        get: (id) => apiFetch(`/api/sessions/${id}`),
        delete: (id) => apiFetch(`/api/sessions/${id}`, { method: 'DELETE' }),
        renameSpeaker: (sessionId, label, displayName) => apiFetch(`/api/sessions/${sessionId}/speakers`, {
            method: 'PATCH',
            body: JSON.stringify({ label, displayName }),
        }),
        audioUrl: (id) => `${config.apiUrl}/api/sessions/${id}/audio`,
        rename: (id, title) => apiFetch(`/api/sessions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ title }),
        }),
        bulkDelete: (ids) => Promise.all(ids.map((id) => apiFetch(`/api/sessions/${id}`, { method: 'DELETE' }))),
    },
    report: {
        get: (id) => apiFetch(`/api/report/${id}`),
        translate: (id, targetLang) => apiFetch(`/api/report/${id}/translate`, {
            method: 'POST',
            body: JSON.stringify({ targetLang }),
        }),
        exportDocxUrl: (id) => `${config.apiUrl}/api/report/${id}/export/docx`,
    },
    translate: {
        segment: (text, targetLang) => apiFetch('/api/translate/segment', {
            method: 'POST',
            body: JSON.stringify({ text, targetLang }),
        }),
    },
    ingest: {
        youtube: (url) => apiFetch('/api/ingest/youtube', {
            method: 'POST',
            body: JSON.stringify({ url }),
        }),
        web: (url) => apiFetch('/api/ingest/web', {
            method: 'POST',
            body: JSON.stringify({ url }),
        }),
        pdf: (file) => {
            const fd = new FormData();
            fd.append('file', file);
            return apiUpload('/api/ingest/pdf', fd);
        },
        video: (file) => {
            const fd = new FormData();
            fd.append('file', file);
            return apiUpload('/api/ingest/video', fd);
        },
        audio: (file) => {
            const fd = new FormData();
            fd.append('file', file);
            return apiUpload('/api/ingest/audio', fd);
        },
    },
    chat: {
        history: (sessionId) => apiFetch(`/api/chat/${sessionId}`),
        send: (sessionId, message) => apiFetch(`/api/chat/${sessionId}`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        }),
    },
};
//# sourceMappingURL=client.js.map