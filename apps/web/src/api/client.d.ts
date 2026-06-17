/**
 * API client — chỉ gọi backend của mình
 * KHÔNG gọi Gemini/STT/Supabase trực tiếp từ frontend
 */
import type { LLMUsage, AppSettings } from '@transcript/shared';
export interface IngestResult {
    sessionId: string;
    reportId: string;
    llmUsage?: LLMUsage;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}
export interface ChatResult {
    answer: string;
    messageId: string;
    llmUsage?: LLMUsage;
}
export declare const api: {
    settings: {
        get: () => Promise<AppSettings>;
        update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
    };
    sessions: {
        list: () => Promise<unknown[]>;
        get: (id: string) => Promise<{
            session: {
                type: string;
                title: string;
            };
        }>;
        delete: (id: string) => Promise<void>;
        renameSpeaker: (sessionId: string, label: string, displayName: string) => Promise<void>;
        audioUrl: (id: string) => string;
        rename: (id: string, title: string) => Promise<void>;
        bulkDelete: (ids: string[]) => Promise<void[]>;
    };
    report: {
        get: (id: string) => Promise<{
            content_md: string;
        }>;
        translate: (id: string, targetLang: "en" | "fr" | "vi") => Promise<{
            content: string;
            cached: boolean;
            llmUsage?: LLMUsage;
        }>;
        exportDocxUrl: (id: string) => string;
    };
    translate: {
        segment: (text: string, targetLang: "en" | "fr" | "vi") => Promise<{
            translation: string;
        }>;
    };
    ingest: {
        youtube: (url: string) => Promise<IngestResult>;
        web: (url: string) => Promise<IngestResult>;
        pdf: (file: File) => Promise<IngestResult>;
        video: (file: File) => Promise<IngestResult>;
        audio: (file: File) => Promise<IngestResult>;
    };
    chat: {
        history: (sessionId: string) => Promise<ChatMessage[]>;
        send: (sessionId: string, message: string) => Promise<ChatResult>;
    };
};
//# sourceMappingURL=client.d.ts.map