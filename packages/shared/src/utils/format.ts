// Pure utility functions — không có side effects, không import ngoài shared

/**
 * Format số giây thành HH:MM:SS hoặc MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format duration (giây) thành "1h 23m" hoặc "45m 30s"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Truncate text với ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Đổi tên speaker trong toàn bộ transcript (Speaker 1 → display name)
 */
export function applySpeakerNames(
  text: string,
  speakerMap: Record<string, string>,
): string {
  let result = text
  for (const [label, displayName] of Object.entries(speakerMap)) {
    result = result.replaceAll(label, displayName)
  }
  return result
}
