/**
 * LLM Router — DUY NHẤT nơi gọi Gemini / OpenRouter
 *
 * Mọi nơi khác trong codebase PHẢI gọi qua hàm `llm.complete()` này.
 * TUYỆT ĐỐI không import SDK của Gemini/OpenRouter trực tiếp ở nơi khác.
 *
 * Key resolution (theo thứ tự ưu tiên):
 *   1. Settings file (~/.transcript-ai/settings.json)  ← user fills in Settings page
 *   2. Environment variable GEMINI_API_KEY              ← dev fallback via .env
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMRequest } from '@transcript/shared'
import { LLM_RATE_LIMIT_RETRY_MS } from '@transcript/shared'
import { config } from '../config.js'
import { getSettings } from '../settings/store.js'

interface LLMResponse {
  text: string
  model: string
  usage?: { inputTokens: number; outputTokens: number }
}

async function getGeminiKey(): Promise<string> {
  const settings = await getSettings()
  const key = settings.apiKeys.gemini || config.geminiApiKey
  if (!key) throw new Error('Gemini API key not configured. Go to Settings to add your key.')
  return key
}

async function callGemini(
  prompt: string,
  systemPrompt?: string,
  modelName = 'gemini-2.5-flash',
): Promise<LLMResponse> {
  const apiKey = await getGeminiKey()
  const client = new GoogleGenerativeAI(apiKey)

  const model = client.getGenerativeModel({
    model: modelName,
    ...(systemPrompt !== undefined && { systemInstruction: systemPrompt }),
    // Disable thinking tokens — prevents "THOUGHTS:" leaking into responses
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object,
  })

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const meta = result.response.usageMetadata
  const usage = meta
    ? { inputTokens: meta.promptTokenCount ?? 0, outputTokens: meta.candidatesTokenCount ?? 0 }
    : undefined

  return { text, model: modelName, ...(usage && { usage }) }
}

async function callOpenRouter(
  prompt: string,
  modelId: string,
  apiKey: string,
): Promise<LLMResponse> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://transcript-tool.app',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${text}`)
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[]
    model: string
  }

  const text = data.choices[0]?.message.content ?? ''
  return { text, model: data.model }
}

/**
 * Main entry point — gọi cái này ở mọi nơi cần LLM
 * KHÔNG gọi Gemini/OpenRouter trực tiếp ở nơi khác
 */
export const llm = {
  async complete(req: LLMRequest): Promise<LLMResponse> {
    // Mọi thứ liên quan đến transcript → sensitive: true → phải dùng paid model
    if (req.sensitive || req.tier === 'final') {
      return callGemini(req.prompt, req.systemPrompt, 'gemini-2.5-flash')
    }

    // tier: 'draft', không nhạy cảm → thử free key trước
    const freeKey = config.openrouterFreeKey
    if (freeKey) {
      try {
        return await callOpenRouter(req.prompt, 'deepseek/deepseek-chat:free', freeKey)
      } catch (err) {
        const is429 = err instanceof Error && err.message.includes('429')
        if (!is429) throw err
        // Rate limited → đợi rồi fallback sang Gemini
        await new Promise((r) => setTimeout(r, LLM_RATE_LIMIT_RETRY_MS))
      }
    }

    return callGemini(req.prompt, req.systemPrompt)
  },
}
