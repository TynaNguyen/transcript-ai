import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getSettings, updateSettings } from '../settings/store.js'

export const settingsRoutes = new Hono()

const settingsPatchSchema = z.object({
  apiKeys: z
    .object({
      gemini: z.string().optional(),
      assemblyai: z.string().optional(),
      deepgram: z.string().optional(),
      gladia: z.string().optional(),
    })
    .optional(),
  sttProvider: z.enum(['assemblyai', 'deepgram', 'gemini', 'gladia']).optional(),
  liveRecording: z
    .object({
      defaultSourceLang: z.string().nullable().optional(),
      defaultTranslateLang: z.enum(['en', 'fr', 'vi']).nullable().optional(),
    })
    .optional(),
})

// GET /api/settings
settingsRoutes.get('/', async (c) => {
  const settings = await getSettings()
  return c.json({ success: true, data: settings })
})

// PUT /api/settings
settingsRoutes.put(
  '/',
  zValidator('json', settingsPatchSchema),
  async (c) => {
    const patch = c.req.valid('json')
    const updated = await updateSettings(patch as Parameters<typeof updateSettings>[0])
    return c.json({ success: true, data: updated })
  },
)
