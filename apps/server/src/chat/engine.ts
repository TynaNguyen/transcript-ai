/**
 * Chat Engine — Phase 3
 *
 * Flow:
 *   1. Load transcript + report from local store (context)
 *   2. Load last N messages (conversation history)
 *   3. Build prompt: system context + history + new message
 *   4. llm.complete() — sensitive: true (nội dung transcript)
 *   5. Save user + assistant messages
 *   6. Return response text + messageId
 */

import type { LLMUsage } from '@transcript/shared'
import { store } from '../db/local.js'
import { llm } from '../llm/router.js'

const MAX_HISTORY = 10
const MAX_CONTEXT_CHARS = 60_000

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + `\n\n[... truncated ${text.length - max} characters ...]`
}

export interface ChatResult {
  answer: string
  messageId: string
  llmUsage: LLMUsage
}

export async function chat(sessionId: string, userMessage: string): Promise<ChatResult> {
  const [transcript, report, history] = await Promise.all([
    store.getTranscript(sessionId),
    store.getReportBySession(sessionId),
    store.listMessages(sessionId),
  ])

  const rawText = transcript?.raw_text ?? ''
  const reportMd = report?.content_md ?? ''
  const recentHistory = history.slice(-MAX_HISTORY * 2)

  const contextParts: string[] = []
  if (reportMd) contextParts.push(`## Summary Report\n\n${reportMd}`)
  if (rawText) contextParts.push(`## Full Transcript\n\n${truncate(rawText, MAX_CONTEXT_CHARS)}`)

  const systemPrompt =
    `You are an AI assistant helping the user analyze and discuss content from a recorded session.\n\n` +
    `Answer questions based ONLY on the session content below. ` +
    `If the answer isn't in the content, say so clearly. ` +
    `Be concise and direct.\n\n` +
    (contextParts.length > 0
      ? `---\n\n${contextParts.join('\n\n---\n\n')}`
      : `(No session content available yet.)`)

  const conversationLines: string[] = []
  for (const msg of recentHistory) {
    conversationLines.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
  }
  conversationLines.push(`User: ${userMessage}`)
  conversationLines.push(`Assistant:`)

  const result = await llm.complete({
    prompt: conversationLines.join('\n\n'),
    systemPrompt,
    tier: 'final',
    sensitive: true,
  })

  const answer = result.text.trim()
  const PRICE_IN = 0.15 / 1_000_000
  const PRICE_OUT = 0.60 / 1_000_000
  const inputTokens = result.usage?.inputTokens ?? 0
  const outputTokens = result.usage?.outputTokens ?? 0
  const llmUsage: LLMUsage = {
    model: result.model,
    inputTokens,
    outputTokens,
    costUsd: inputTokens * PRICE_IN + outputTokens * PRICE_OUT,
  }

  const saved = await store.createMessages([
    { session_id: sessionId, role: 'user', content: userMessage },
    { session_id: sessionId, role: 'assistant', content: answer },
  ])

  const assistantMsg = saved.find((m) => m.role === 'assistant')
  return { answer, messageId: assistantMsg?.id ?? '', llmUsage }
}
