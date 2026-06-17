import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { store } from '../db/local.js'

const AUDIO_DIR = '/tmp/transcript-audio'

export const sessionRoutes = new Hono()

// GET /api/sessions — list recent sessions
sessionRoutes.get('/', async (c) => {
  try {
    const data = await store.listSessions()
    return c.json({ success: true, data })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// PATCH /api/sessions/:id — rename session
sessionRoutes.patch(
  '/:id',
  zValidator('json', z.object({ title: z.string().min(1).max(200) })),
  async (c) => {
    const id = c.req.param('id')
    const { title } = c.req.valid('json')
    try {
      await store.updateSession(id, { title })
      return c.json({ success: true })
    } catch (err) {
      return c.json({ success: false, error: String(err) }, 500)
    }
  },
)

// GET /api/sessions/:id — get single session with transcript + report
sessionRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const bundle = await store.getBundle(id)
  if (!bundle) return c.json({ success: false, error: 'Session not found' }, 404)

  return c.json({
    success: true,
    data: {
      session: bundle.session,
      transcript: bundle.transcript,
      report: bundle.report,
      speakers: bundle.speakers,
    },
  })
})

// PATCH /api/sessions/:id/speakers — rename a speaker
sessionRoutes.patch(
  '/:id/speakers',
  zValidator('json', z.object({ label: z.string(), displayName: z.string() })),
  async (c) => {
    const sessionId = c.req.param('id')
    const { label, displayName } = c.req.valid('json')
    try {
      await store.upsertSpeaker({ session_id: sessionId, label, display_name: displayName })
      return c.json({ success: true })
    } catch (err) {
      return c.json({ success: false, error: String(err) }, 500)
    }
  },
)

// GET /api/sessions/:id/audio — stream live recording audio file (webm)
sessionRoutes.get('/:id/audio', async (c) => {
  const id = c.req.param('id')
  const bundle = await store.getBundle(id)
  if (!bundle || bundle.session.type !== 'live') {
    return c.json({ success: false, error: 'Session not found' }, 404)
  }

  const filePath = `${AUDIO_DIR}/${id}.webm`
  if (!existsSync(filePath)) {
    return c.json({ success: false, error: 'Audio file not available (server may have restarted)' }, 404)
  }

  const safeTitle = bundle.session.title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  const buffer = await readFile(filePath)

  c.header('Content-Type', 'audio/webm')
  c.header('Content-Disposition', `attachment; filename="${safeTitle}.webm"`)
  return c.body(buffer)
})

// DELETE /api/sessions/:id
sessionRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    await store.deleteSession(id)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})
