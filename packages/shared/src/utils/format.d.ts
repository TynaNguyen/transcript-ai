/**
 * Format số giây thành HH:MM:SS hoặc MM:SS
 */
export declare function formatTimestamp(seconds: number): string;
/**
 * Format duration (giây) thành "1h 23m" hoặc "45m 30s"
 */
export declare function formatDuration(seconds: number): string;
/**
 * Truncate text với ellipsis
 */
export declare function truncate(text: string, maxLength: number): string;
/**
 * Đổi tên speaker trong toàn bộ transcript (Speaker 1 → display name)
 */
export declare function applySpeakerNames(text: string, speakerMap: Record<string, string>): string;
//# sourceMappingURL=format.d.ts.map