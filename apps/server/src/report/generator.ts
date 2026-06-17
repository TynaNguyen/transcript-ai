import type { NormalizedContent, ReportRequest, LLMUsage } from '@transcript/shared'
import { llm } from '../llm/router.js'
import { store } from '../db/local.js'
import { buildReportPrompt } from './templates.js'

const GEMINI_FLASH_INPUT_PRICE = 0.15 / 1_000_000
const GEMINI_FLASH_OUTPUT_PRICE = 0.60 / 1_000_000

export async function generateReport(
  content: NormalizedContent,
  req: ReportRequest,
): Promise<{ reportId: string; contentMd: string; llmUsage: LLMUsage }> {
  const prompt = buildReportPrompt(content, req.template)
  const hasTranscript = Boolean(content.transcript?.length)

  const response = await llm.complete({ prompt, tier: 'final', sensitive: hasTranscript })

  const inputTokens = response.usage?.inputTokens ?? 0
  const outputTokens = response.usage?.outputTokens ?? 0
  const llmUsage: LLMUsage = {
    model: response.model,
    inputTokens,
    outputTokens,
    costUsd: inputTokens * GEMINI_FLASH_INPUT_PRICE + outputTokens * GEMINI_FLASH_OUTPUT_PRICE,
  }

  const report = await store.createReport({
    session_id: content.sessionId,
    template: req.template,
    content_md: response.text,
  })

  return { reportId: report.id, contentMd: response.text, llmUsage }
}

export async function getReport(reportId: string): Promise<string> {
  const report = await store.getReport(reportId)
  if (!report) throw new Error(`Report not found: ${reportId}`)
  return report.content_md
}
