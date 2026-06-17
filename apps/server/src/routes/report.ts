import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { writeFile, readFile, unlink } from 'fs/promises'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import type { LLMUsage } from '@transcript/shared'
import { store } from '../db/local.js'
import { llm } from '../llm/router.js'

const PRICE_IN = 0.15 / 1_000_000
const PRICE_OUT = 0.60 / 1_000_000
function makeLLMUsage(model: string, input: number, output: number): LLMUsage {
  return { model, inputTokens: input, outputTokens: output, costUsd: input * PRICE_IN + output * PRICE_OUT }
}

const exec = promisify(execCb)

export const reportRoutes = new Hono()

// GET /api/report/:id
reportRoutes.get('/:id', async (c) => {
  const report = await store.getReport(c.req.param('id'))
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404)
  return c.json({ success: true, data: report })
})

// POST /api/report/:id/translate
reportRoutes.post(
  '/:id/translate',
  zValidator('json', z.object({ targetLang: z.enum(['en', 'fr', 'vi']) })),
  async (c) => {
    const reportId = c.req.param('id')
    const { targetLang } = c.req.valid('json')

    const cached = await store.getTranslation(reportId, 'report', targetLang)
    if (cached) return c.json({ success: true, data: { content: cached, cached: true } })

    const report = await store.getReport(reportId)
    if (!report) return c.json({ success: false, error: 'Report not found' }, 404)

    const langNames = { en: 'English', fr: 'French', vi: 'Vietnamese' }
    const result = await llm.complete({
      prompt: `Translate the following meeting report to ${langNames[targetLang]}.
Keep all markdown formatting exactly.
Keep all timestamps, speaker names, and table structure intact.
Only translate the text content, not the markdown syntax.

REPORT:
${report.content_md}`,
      tier: 'final',
      sensitive: true,
    })

    await store.createTranslation({
      source_id: reportId,
      source_type: 'report',
      target_lang: targetLang,
      content: result.text,
    })

    const llmUsage = makeLLMUsage(
      result.model,
      result.usage?.inputTokens ?? 0,
      result.usage?.outputTokens ?? 0,
    )
    return c.json({ success: true, data: { content: result.text, cached: false, llmUsage } })
  },
)

// GET /api/report/:id/export/docx
reportRoutes.get('/:id/export/docx', async (c) => {
  const report = await store.getReport(c.req.param('id'))
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404)

  const title = report.session_title ?? 'report'
  const safeTitle = title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  const tmpMd = `/tmp/report-${Date.now()}.md`
  const tmpDocx = `/tmp/report-${Date.now()}.docx`

  try {
    await writeFile(tmpMd, report.content_md, 'utf8')
    await exec(`/usr/bin/pandoc "${tmpMd}" -o "${tmpDocx}" --standalone`)
    const docxBuffer = await readFile(tmpDocx)

    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    c.header('Content-Disposition', `attachment; filename="${safeTitle}.docx"`)
    return c.body(docxBuffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ success: false, error: `Export failed: ${msg}` }, 500)
  } finally {
    await Promise.allSettled([unlink(tmpMd), unlink(tmpDocx)])
  }
})
