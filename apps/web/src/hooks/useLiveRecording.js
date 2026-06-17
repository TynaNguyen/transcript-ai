/**
 * Hook quản lý toàn bộ live recording flow.
 *
 * Audio strategy:
 *   - ScriptProcessorNode → raw PCM Int16 → WebSocket → AssemblyAI realtime (transcript)
 *   - MediaRecorder → WebM/Opus → WebSocket → lưu file → batch STT sau khi Stop
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { config } from '../config.js';
import { WS_RECONNECT_DELAY_MS, WS_MAX_RECONNECT_ATTEMPTS, STT_SAMPLE_RATE } from '@transcript/shared';
import { api } from '../api/client.js';
/** Convert Float32 PCM samples → Int16 PCM buffer (what AssemblyAI expects) */
function float32ToInt16(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16.buffer;
}
/** Downsample from sampleRate → targetRate (simple decimation) */
function downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate)
        return buffer;
    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        result[i] = buffer[Math.round(i * ratio)] ?? 0;
    }
    return result;
}
export function useLiveRecording(opts = {}) {
    const { initialSourceLang = 'en', initialTranslateLang = 'vi' } = opts;
    const [status, setStatus] = useState('idle');
    const [lines, setLines] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [reportId, setReportId] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [duration, setDuration] = useState(0);
    const [recordedDuration, setRecordedDuration] = useState(0);
    const [sessionCost, setSessionCost] = useState(null);
    const [translateLang, setTranslateLang] = useState(initialTranslateLang);
    const translateLangRef = useRef(initialTranslateLang);
    const [sourceLang, setSourceLang] = useState(initialSourceLang);
    const sourceLangRef = useRef(initialSourceLang);
    function handleSetSourceLang(lang) {
        sourceLangRef.current = lang;
        setSourceLang(lang);
    }
    const localChunksRef = useRef([]);
    const wsRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const scriptProcessorRef = useRef(null);
    const analyserRef = useRef(null);
    const timerRef = useRef(null);
    const levelAnimRef = useRef(null);
    const reconnectCountRef = useRef(0);
    const intentionalCloseRef = useRef(false);
    const startTimeRef = useRef(0);
    const sessionIdRef = useRef(null);
    // Giữ ref đồng bộ với state để closure bên WS onmessage dùng được
    function handleSetTranslateLang(lang) {
        translateLangRef.current = lang;
        setTranslateLang(lang);
    }
    // Dịch 1 câu final và cập nhật line đó trong state
    function translateLine(lineId, text, lang) {
        console.log(`[TRANSLATE] → ${lang}: "${text.slice(0, 60)}"`);
        api.translate.segment(text, lang)
            .then(({ translation }) => {
            console.log(`[TRANSLATE] ✓ "${translation.slice(0, 60)}"`);
            setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, translation, translating: false } : l));
        })
            .catch((err) => {
            console.error('[TRANSLATE] ✗', err);
            // Non-fatal: ẩn spinner, giữ nguyên câu gốc
            setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, translating: false } : l));
        });
    }
    useEffect(() => () => cleanup(), []);
    function cleanup() {
        intentionalCloseRef.current = true;
        scriptProcessorRef.current?.disconnect();
        mediaRecorderRef.current?.stop();
        if (audioContextRef.current?.state !== 'closed') {
            audioContextRef.current?.close().catch(() => { });
        }
        wsRef.current?.close();
        if (timerRef.current)
            clearInterval(timerRef.current);
        if (levelAnimRef.current)
            cancelAnimationFrame(levelAnimRef.current);
    }
    function sendWS(type, data) {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, data }));
        }
    }
    async function connectWebSocket(attemptsLeft = 5) {
        const ws = await (async () => {
            for (let i = attemptsLeft; i > 0; i--) {
                try {
                    return await new Promise((resolve, reject) => {
                        const langParam = sourceLangRef.current ? `?lang=${sourceLangRef.current}` : '';
                        const sock = new WebSocket(`${config.wsUrl}/ws/live${langParam}`);
                        const t = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
                        sock.onopen = () => { clearTimeout(t); resolve(sock); };
                        sock.onerror = () => { clearTimeout(t); reject(new Error('connect failed')); };
                    });
                }
                catch {
                    if (i > 1)
                        await new Promise((r) => setTimeout(r, 1000));
                }
            }
            throw new Error('WebSocket failed to connect');
        })();
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'partial_transcript') {
                    const data = msg.data;
                    if (data.sessionId && !sessionIdRef.current) {
                        sessionIdRef.current = data.sessionId;
                        setSessionId(data.sessionId);
                    }
                    if (data.text) {
                        const partial = data;
                        setLines((prev) => {
                            const last = prev[prev.length - 1];
                            const lineId = `p-${Date.now()}`;
                            if (last && !last.isFinal) {
                                // Câu vừa trở thành final → kick off translation
                                const needsTranslation = partial.isFinal && !last.isFinal && translateLangRef.current;
                                if (needsTranslation) {
                                    const lang = translateLangRef.current;
                                    setTimeout(() => translateLine(last.id, partial.text, lang), 0);
                                }
                                const updated = {
                                    id: last.id,
                                    speaker: partial.speaker ?? last.speaker,
                                    text: partial.text,
                                    isFinal: partial.isFinal,
                                    ...(partial.start != null && { start: partial.start }),
                                    ...(needsTranslation && { translating: true }),
                                };
                                return [...prev.slice(0, -1), updated];
                            }
                            // Câu mới
                            const needsTranslation = partial.isFinal && translateLangRef.current;
                            if (needsTranslation) {
                                const lang = translateLangRef.current;
                                setTimeout(() => translateLine(lineId, partial.text, lang), 0);
                            }
                            const newLine = {
                                id: lineId,
                                speaker: partial.speaker ?? 'Speaker 1',
                                text: partial.text,
                                isFinal: partial.isFinal,
                                ...(partial.start != null && { start: partial.start }),
                                ...(needsTranslation && { translating: true }),
                            };
                            return [...prev, newLine];
                        });
                    }
                }
                if (msg.type === 'final_transcript') {
                    const segments = msg.data;
                    setLines(segments.map((s, i) => ({
                        id: `f-${i}`, speaker: s.speaker, text: s.text, isFinal: true, start: s.start,
                    })));
                    setStatus('processing');
                }
                if (msg.type === 'session_end') {
                    const data = msg.data;
                    setSessionId(data.sessionId);
                    setReportId(data.reportId);
                    if (data.cost)
                        setSessionCost(data.cost);
                    setStatus('done');
                    cleanup();
                }
                if (msg.type === 'error') {
                    const data = msg.data;
                    setErrorMessage(data.message);
                    setStatus('error');
                }
            }
            catch { /* ignore parse errors */ }
        };
        ws.onclose = () => {
            if (!intentionalCloseRef.current && reconnectCountRef.current < WS_MAX_RECONNECT_ATTEMPTS) {
                reconnectCountRef.current++;
                setTimeout(() => {
                    connectWebSocket().then((newWs) => { wsRef.current = newWs; }).catch(console.error);
                }, WS_RECONNECT_DELAY_MS);
            }
        };
        return ws;
    }
    const startRecording = useCallback(async () => {
        try {
            setStatus('recording');
            setLines([]);
            setDuration(0);
            setRecordedDuration(0);
            setErrorMessage(null);
            setSessionCost(null);
            localChunksRef.current = [];
            startTimeRef.current = Date.now();
            // ── Capture audio ────────────────────────────────────────────────────────
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const ctx = new AudioContext();
            audioContextRef.current = ctx;
            const micSource = ctx.createMediaStreamSource(micStream);
            // Analyser for waveform (on mic)
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            micSource.connect(analyser);
            const finalSource = micSource;
            // ── ScriptProcessorNode → PCM Int16 → WebSocket (for AssemblyAI realtime)
            // ScriptProcessorNode is deprecated but AudioWorklet requires a separate file
            // 1024 buffer = ~64ms chunks → faster partial transcript updates
            const scriptProcessor = ctx.createScriptProcessor(1024, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            finalSource.connect(scriptProcessor);
            scriptProcessor.connect(ctx.destination); // needed to keep it active
            // ── MediaRecorder → WebM (for batch STT after Stop) ─────────────────────
            const dest = ctx.createMediaStreamDestination();
            finalSource.connect(dest);
            const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current = recorder;
            // ── Connect WebSocket ─────────────────────────────────────────────────────
            const ws = await connectWebSocket();
            wsRef.current = ws;
            // ── Start streaming PCM chunks ────────────────────────────────────────────
            scriptProcessor.onaudioprocess = (event) => {
                if (ws.readyState !== WebSocket.OPEN)
                    return;
                const float32 = event.inputBuffer.getChannelData(0);
                // Downsample to 16kHz (AssemblyAI realtime requires 16kHz PCM)
                const downsampled = downsample(float32, ctx.sampleRate, STT_SAMPLE_RATE);
                const pcm = float32ToInt16(downsampled);
                const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm)));
                sendWS('audio_chunk', base64);
            };
            // ── MediaRecorder chunks → backend + local store ──────────────────────────
            recorder.ondataavailable = (e) => {
                if (e.data.size === 0)
                    return;
                // Lưu local để download sau
                localChunksRef.current.push(e.data);
                // Gửi lên server để batch STT
                if (ws.readyState === WebSocket.OPEN) {
                    e.data.arrayBuffer().then((buf) => {
                        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                        sendWS('audio_batch_chunk', base64);
                    }).catch(console.error);
                }
            };
            recorder.start(1000); // batch chunks every 1s
            // ── Audio level animation (from analyser) ─────────────────────────────────
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setAudioLevel(avg / 255);
                levelAnimRef.current = requestAnimationFrame(updateLevel);
            };
            levelAnimRef.current = requestAnimationFrame(updateLevel);
            // ── Duration timer ────────────────────────────────────────────────────────
            timerRef.current = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        }
        catch (err) {
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : 'Failed to start recording');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const stopRecording = useCallback(() => {
        setStatus('processing');
        setRecordedDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        scriptProcessorRef.current?.disconnect();
        mediaRecorderRef.current?.stop();
        if (timerRef.current)
            clearInterval(timerRef.current);
        if (levelAnimRef.current)
            cancelAnimationFrame(levelAnimRef.current);
        setAudioLevel(0);
        sendWS('session_end');
    }, []);
    const downloadAudio = useCallback(() => {
        const chunks = localChunksRef.current;
        if (chunks.length === 0)
            return;
        const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        a.download = `recording-${ts}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);
    return {
        status, lines, sessionId, reportId, sessionCost, errorMessage,
        audioLevel, duration, recordedDuration, translateLang,
        setTranslateLang: handleSetTranslateLang,
        sourceLang, setSourceLang: handleSetSourceLang,
        startRecording, stopRecording, downloadAudio,
    };
}
//# sourceMappingURL=useLiveRecording.js.map