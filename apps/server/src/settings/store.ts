import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { AppSettings } from '@transcript/shared'

export const DATA_DIR = join(homedir(), '.transcript-ai')
const SETTINGS_FILE = join(DATA_DIR, 'settings.json')

export const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: { gemini: '', assemblyai: '', deepgram: '', gladia: '' },
  sttProvider: 'assemblyai',
  liveRecording: { defaultSourceLang: 'en', defaultTranslateLang: 'vi' },
}

let _cache: AppSettings | null = null

export async function getSettings(): Promise<AppSettings> {
  if (_cache) return _cache
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    _cache = deepMerge(DEFAULT_SETTINGS, parsed) as AppSettings
    return _cache
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      apiKeys: { ...DEFAULT_SETTINGS.apiKeys },
      liveRecording: { ...DEFAULT_SETTINGS.liveRecording },
    }
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const updated = deepMerge(current, patch) as AppSettings
  _cache = updated
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return updated
}

export function invalidateSettingsCache(): void {
  _cache = null
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sv = source[key]
    const tv = target[key]
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>)
    } else if (sv !== undefined) {
      result[key] = sv
    }
  }
  return result
}
