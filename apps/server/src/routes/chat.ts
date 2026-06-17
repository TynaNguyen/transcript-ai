import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { store } from '../db/local.js'
import { chat } from '../chat/engine.js'

export const chatRoutes = new Hono()

// GET /api/chat/:sessionId — load lịch sử
chatRoutes.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  try {
    const data = await store.listMessages(sessionId)
    return c.json({ success: true, data })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// POST /api/chat/:sessionId — gửi message
chatRoutes.post(
  '/:sessionId',
  zValidator('json', z.object({ message: z.string().min(1).max(2000) })),
  async (c) => {
    const sessionId = c.req.param('sessionId')
    const { message } = c.req.valid('json')

    const bundle = await store.getBundle(sessionId)
    if (!bundle) return c.json({ success: false, error: 'Session not found' }, 404)

    try {
      const result = await chat(sessionId, message)
      return c.json({ success: true, data: result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return c.json({ success: false, error: msg }, 500)
    }
  },
)
