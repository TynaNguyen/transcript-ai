/**
 * YouTube Ingestor v3
 * Strategy:
 *  1. Fetch YouTube page → capture cookies + title/duration + captionTracks snippet
 *  2. Try timedtext with cookies (multiple fallbacks):
 *     a. ?lang=en               (manual or default)
 *     b. ?lang=en&kind=asr      (auto-generated)
 *     c. lang from captionTracks in page HTML (exact language code)
 *     d. type=list to enumerate languages, try each
 */

import type { NormalizedContent, TranscriptSegment } from '@transcript/shared'

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

/** Lấy video ID từ nhiều dạng YouTube URL */
function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    const v = u.searchParams.get('v')
    if (v) return v
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] ?? null
    const shorts = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/)
    if (shorts) return shorts[1] ?? null
  } catch { /* ignore */ }
  return null
}

/** Decode HTML entities */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n/g, ' ')
    .trim()
}

/** Parse <text start dur> XML → TranscriptSegment[] */
function parseTimedtextXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const re1 = /<text\b[^>]*\bstart="([^"]+)"[^>]*\bdur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
  const re2 = /<text\b[^>]*\bdur="([^"]+)"[^>]*\bstart="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
  let m: RegExpExecArray | null

  while ((m = re1.exec(xml)) !== null) {
    const start = parseFloat(m[1] ?? '0')
    const dur   = parseFloat(m[2] ?? '0')
    const text  = decodeEntities(m[3] ?? '')
    if (text) segments.push({ start, end: start + dur, speaker: 'Speaker 1', text })
  }
  if (segments.length === 0) {
    while ((m = re2.exec(xml)) !== null) {
      const dur   = parseFloat(m[1] ?? '0')
      const start = parseFloat(m[2] ?? '0')
      const text  = decodeEntities(m[3] ?? '')
      if (text) segments.push({ start, end: start + dur, speaker: 'Speaker 1', text })
    }
  }
  return segments
}

/** Fetch timedtext for one (lang, kind?) combo. Returns [] on any failure. */
async function tryTimedtext(
  videoId: string,
  lang: string,
  headers: Record<string, string>,
  kind?: string,
): Promise<TranscriptSegment[]> {
  try {
    let url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${encodeURIComponent(lang)}`
    if (kind) url += `&kind=${encodeURIComponent(kind)}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const xml = await res.text()
    if (!xml.includes('<text')) return []
    return parseTimedtextXml(xml)
  } catch {
    return []
  }
}

/** Extract language codes from timedtext?type=list */
async function getLanguageList(
  videoId: string,
  headers: Record<string, string>,
): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
      { headers, signal: AbortSignal.timeout(8_000) },
    )
    if (!res.ok) return []
    const xml = await res.text()
    const langs: string[] = []
    const re = /lang_code="([^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      if (m[1]) langs.push(m[1])
    }
    return langs
  } catch {
    return []
  }
}

/**
 * Parse lang codes that appear in captionTracks inside page HTML.
 * These are the actual tracks the video has (manual + ASR).
 * Format in HTML: "languageCode":"en" near captionTracks
 */
function parseLangCodesFromHtml(html: string): string[] {
  const start = html.indexOf('"captionTracks"')
  if (start === -1) return []
  const chunk = html.slice(start, start + 15_000)
  const langs: string[] = []
  const re = /"languageCode":"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(chunk)) !== null) {
    if (m[1] && !langs.includes(m[1])) langs.push(m[1])
  }
  return langs
}

export async function ingestYoutube(sessionId: string, url: string): Promise<NormalizedContent> {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error(`Cannot extract video ID from URL: ${url}`)

  // ── Step 1: Fetch page (cookies + meta + HTML) ──────────────────────────────
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: BASE_HEADERS,
    signal: AbortSignal.timeout(15_000),
  })
  if (!pageRes.ok) throw new Error(`YouTube page fetch failed: HTTP ${pageRes.status}`)

  // Capture cookies to pass to timedtext requests
  const setCookies: string[] = (pageRes.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie?.() ?? []
  const cookieStr = setCookies.map((c) => c.split(';')[0]).join('; ')
  const reqHeaders: Record<string, string> = {
    ...BASE_HEADERS,
    ...(cookieStr ? { Cookie: cookieStr } : {}),
  }

  const html = await pageRes.text()

  // Title
  const rawTitle = html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(' - YouTube', '').trim() ?? videoId
  const title = decodeEntities(rawTitle)

  // Duration
  const durMatch = html.match(/"lengthSeconds"[^:]*:\s*"?(\d+)"?/)
  const duration = durMatch?.[1] ? parseInt(durMatch[1], 10) : 0

  // ── Step 2: Try to fetch transcript (multiple fallbacks) ───────────────────

  let segments: TranscriptSegment[] = []

  // 2a. ?lang=en (manual preferred, may include ASR depending on YouTube)
  segments = await tryTimedtext(videoId, 'en', reqHeaders)
  if (segments.length > 0) return buildResult(sessionId, videoId, segments, title, duration)

  // 2b. ?lang=en&kind=asr (explicit auto-generated)
  segments = await tryTimedtext(videoId, 'en', reqHeaders, 'asr')
  if (segments.length > 0) return buildResult(sessionId, videoId, segments, title, duration)

  // 2c. Lang codes found in page HTML (handles non-English videos)
  const htmlLangs = parseLangCodesFromHtml(html)
  for (const lang of htmlLangs) {
    if (lang === 'en') continue // already tried
    segments = await tryTimedtext(videoId, lang, reqHeaders)
    if (segments.length > 0) return buildResult(sessionId, videoId, segments, title, duration)
    segments = await tryTimedtext(videoId, lang, reqHeaders, 'asr')
    if (segments.length > 0) return buildResult(sessionId, videoId, segments, title, duration)
  }

  // 2d. type=list enumerate (manual captions list)
  const listedLangs = await getLanguageList(videoId, reqHeaders)
  for (const lang of listedLangs) {
    segments = await tryTimedtext(videoId, lang, reqHeaders)
    if (segments.length > 0) return buildResult(sessionId, videoId, segments, title, duration)
  }

  // No captions found
  const hasCaptionTracks = html.includes('"captionTracks"')
  throw new Error(
    hasCaptionTracks
      ? `Video "${title}" has captions but they could not be fetched (YouTube may be restricting access). ` +
        `Please try a different video or try again later.`
      : `Video "${title}" has no captions available. ` +
        `YouTube videos need captions or subtitles enabled to generate a report. ` +
        `Try a video of a talk, lecture, podcast, or meeting — music videos typically don't have captions.`,
  )
}

function buildResult(
  sessionId: string,
  videoId: string,
  segments: TranscriptSegment[],
  title: string,
  duration: number,
): NormalizedContent {
  return {
    sessionId,
    kind: 'youtube',
    transcript: segments,
    meta: {
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      duration,
    },
  }
}
