import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { llm } from '../llm/router.js'

export const translateRoutes = new Hono()

const LANG_NAMES: Record<string, string> = { en: 'English', fr: 'French', vi: 'Vietnamese' }

// POST /api/translate/segment — dịch 1 câu ngắn real-time
translateRoutes.post(
  '/segment',
  zValidator('json', z.object({
    text: z.string().min(1).max(1000),
    targetLang: z.enum(['en', 'fr', 'vi']),
  })),
  async (c) => {
    const { text, targetLang } = c.req.valid('json')
    console.warn('[TRANSLATE] segment request: lang=%s text=%s', targetLang, text.slice(0, 60))

    const result = await llm.complete({
      prompt: `Translate to ${LANG_NAMES[targetLang]}. Return ONLY the translation, nothing else.\n\n${text}`,
      tier: 'final',
      sensitive: true,  // transcript content — phải dùng no-training model
    })

    return c.json({ success: true, data: { translation: result.text.trim() } })
  },
)
