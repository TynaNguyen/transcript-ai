/**
 * Website Ingestor
 * Fetch URL → strip HTML → clean text → NormalizedContent
 * Không dùng @mozilla/readability (không cài được) → regex strip đủ dùng vì Gemini xử lý phần còn lại
 */

import type { NormalizedContent } from '@transcript/shared'
import { llm } from '../llm/router.js'

/** Strip HTML tags và normalize whitespace */
function htmlToText(html: string): string {
  return html
    // Remove script/style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    // Convert block elements to newlines
    .replace(/<\/?(p|div|h[1-6]|li|tr|br|blockquote|article|section|header|footer|nav|main)[^>]*>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m?.[1]?.trim() ?? ''
}

export async function ingestWeb(sessionId: string, url: string): Promise<NormalizedContent> {
  // 1. Fetch page
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TranscriptAI/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }

  const html = await response.text()
  const rawText = htmlToText(html)
  const htmlTitle = extractTitle(html)

  // Truncate to 50k chars so Gemini doesn't choke on massive pages
  const truncated = rawText.length > 50_000
    ? rawText.slice(0, 50_000) + '\n\n[... content truncated ...]'
    : rawText

  // 2. Ask Gemini to extract structured title + clean content
  const res = await llm.complete({
    prompt: `You are given raw text scraped from the webpage at: ${url}

---
${truncated}
---

Return a JSON object with this exact shape (no markdown fences):
{
  "title": "<page title or article headline>",
  "text": "<cleaned, readable main content — remove nav menus, cookie notices, ads, footers; keep headings and paragraphs>"
}

Respond with ONLY the JSON.`,
    tier: 'draft',
    sensitive: false,
  })

  const raw = res.text.trim()
  const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: { title: string; text: string }
  try {
    parsed = JSON.parse(jsonText) as typeof parsed
  } catch {
    parsed = { title: htmlTitle || url, text: truncated }
  }

  return {
    sessionId,
    kind: 'web',
    text: parsed.text,
    meta: {
      title: parsed.title || htmlTitle || url,
      url,
    },
  }
}
