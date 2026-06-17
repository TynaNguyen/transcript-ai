/**
 * Hook quản lý toàn bộ live recording flow.
 *
 * Audio strategy:
 *   - ScriptProcessorNode → raw PCM Int16 → WebSocket → AssemblyAI realtime (transcript)
 *   - MediaRecorder → WebM/Opus → WebSocket → lưu file → batch STT sau khi Stop
 */
import type { SessionCostSummary } from '@transcript/shared';
export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';
export interface LiveTranscriptLine {
    id: string;
    speaker: string;
    text: string;
    isFinal: boolean;
    start?: number;
    translation?: string;
    translating?: boolean;
}
interface UseLiveRecordingReturn {
    status: RecordingStatus;
    lines: LiveTranscriptLine[];
    sessionId: string | null;
    reportId: string | null;
    sessionCost: SessionCostSummary | null;
    errorMessage: string | null;
    audioLevel: number;
    duration: number;
    recordedDuration: number;
    translateLang: 'en' | 'fr' | 'vi' | null;
    setTranslateLang: (lang: 'en' | 'fr' | 'vi' | null) => void;
    sourceLang: string | null;
    setSourceLang: (lang: string | null) => void;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    downloadAudio: () => void;
}
interface UseLiveRecordingOptions {
    initialSourceLang?: string | null;
    initialTranslateLang?: 'en' | 'fr' | 'vi' | null;
}
export declare function useLiveRecording(opts?: UseLiveRecordingOptions): UseLiveRecordingReturn;
export {};
//# sourceMappingURL=useLiveRecording.d.ts.map