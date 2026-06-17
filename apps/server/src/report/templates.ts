/**
 * Prompt templates cho report generator
 * Sửa prompt ở đây — không sửa generator.ts
 */

import type { NormalizedContent, ReportTemplate } from '@transcript/shared'
import { formatTimestamp } from '@transcript/shared'

export function buildReportPrompt(content: NormalizedContent, template: ReportTemplate): string {
  if (template === 'meeting-minutes') {
    return buildMeetingMinutesPrompt(content)
  }
  return buildContentReportPrompt(content)
}

function buildMeetingMinutesPrompt(content: NormalizedContent): string {
  // Use || not ?? — empty array gives '' which ?? passes through, || falls back correctly
  const transcript = content.transcript?.length
    ? content.transcript.map((s) => `[${formatTimestamp(s.start)}] ${s.speaker}: ${s.text}`).join('\n')
    : undefined

  return `You are an expert meeting facilitator creating detailed meeting minutes.

TRANSCRIPT:
${transcript || content.text || '(no transcript available)'}

Create comprehensive meeting minutes following this structure EXACTLY. Each section must have substantial content — minimum 300 words total. Do NOT summarize briefly; analyze and elaborate on each point.

# Meeting Minutes: {derive a clear title from the content}
**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
**Duration:** ${content.meta.duration ? formatTimestamp(content.meta.duration) : 'Unknown'}
**Participants:** {list all speakers identified, use actual names if available}

## 1. Executive Summary (TL;DR)
Write 3–5 sentences covering: what the meeting was about, the most important decision or conclusion, and the key next step.

## 2. Key Discussion Points
For each major topic discussed:
- Context: what prompted this topic
- Views expressed: who said what (with timestamps)
- Conclusion or outcome

## 3. Decisions Made
For each decision:
- The decision itself
- Who made it / who agreed
- Rationale

## 4. Action Items
| Task | Owner | Due Date | Status |
|------|-------|----------|--------|
{list all action items mentioned}

## 5. Open Questions / Unresolved Issues
- Items that were raised but not concluded

## 6. Notable Quotes
- "{exact quote}" — {Speaker} @ {timestamp}
(include 2–5 quotes that capture key moments)

## 7. Next Steps
What happens after this meeting.

IMPORTANT:
- Keep speaker labels exactly as in transcript (Speaker 1, Speaker 2, etc.)
- Include timestamps for key moments
- Be thorough — this is a formal record, not a brief summary
- Write in clear, professional English`
}

function buildContentReportPrompt(content: NormalizedContent): string {
  const body = content.transcript
    ? content.transcript.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n')
    : content.text ?? '(no content)'

  return `You are an expert analyst creating a comprehensive content report.

SOURCE: ${content.meta.title ?? 'Untitled'} (${content.kind})
URL/FILE: ${content.meta.url ?? 'N/A'}

CONTENT:
${body}

Create a detailed report following this structure. Minimum 400 words. Analyze deeply — do NOT just summarize. Follow the source's structure section by section.

# Report: {derive clear title}
**Source:** ${content.meta.url ?? 'file'} · **Type:** ${content.kind}

## 1. Executive Summary
## 2. Context & Purpose
## 3. Detailed Analysis by Section
(Follow the original structure; for each section: what was said + what it means + implications)
## 4. Key Arguments / Data Points / Statistics
## 5. Insights & Takeaways
(What's worth thinking about; how it applies)
## 6. Limitations / Caveats / Potential Bias
## 7. Notable Quotes
(with timestamps or page numbers for reference)
## 8. Conclusion

IMPORTANT:
- Include timestamps/page numbers for all quotes
- Minimum 400 words
- Write in clear English
- Be analytical, not just descriptive`
}
