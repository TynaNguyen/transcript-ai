import { config as dotenvConfig } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// .env nằm ở root repo (3 cấp lên từ apps/server/src/)
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: resolve(__dirname, '../../../.env') })

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

export const config = {
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  corsOrigin: optional('CORS_ORIGIN') || 'http://localhost:5173',
  // When set, Hono serves the React build at this path (Electron production mode)
  electronWebRoot: optional('ELECTRON_WEB_ROOT'),

  // LLM — optional fallback; user configures their own key via Settings page
  geminiApiKey: optional('GEMINI_API_KEY'),
  openrouterFreeKey: optional('OPENROUTER_FREE_KEY'),
  openrouterPaidKey: optional('OPENROUTER_PAID_KEY'),

  // STT — optional fallback; user configures their own key via Settings page
  sttProvider: optional('STT_PROVIDER', 'assemblyai') as 'assemblyai' | 'deepgram' | 'gemini' | 'gladia',
  assemblyaiKey: optional('ASSEMBLYAI_API_KEY'),
  deepgramKey: optional('DEEPGRAM_API_KEY'),
  gladiaKey: optional('GLADIA_API_KEY'),
} as const
